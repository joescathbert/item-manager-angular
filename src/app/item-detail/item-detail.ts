import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { switchMap, catchError, tap, map, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

import { Item as ItemService } from '../services/item';
import { TagFilter as TagFilterService } from '../services/tag-filter';
import { Item as ItemInterface, SafeItem as SafeItemInterface, ItemNeighbors, MediaURL, SafeMediaURL, File as FileInterface, SafeFile } from '../interfaces/item';
import { MediaMode } from '../interfaces/misc';

import { environment } from '../../environments/environment';
import { VideoObserver } from '../directives/video-observer';

@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [RouterModule, VideoObserver, CommonModule],
  templateUrl: './item-detail.html',
  styleUrl: './item-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetail implements OnInit {
  item: SafeItemInterface | null = null; // Variable to hold current Item data
  loading = true; // Initialize to true to show loading state
  showAllTags: boolean = false; // Start collapsed, or true for expanded

  activeTagFilters: string[] = []; // Variable to store the tags currently being filtered

  activeOptionsMenuId: number | null = null; // Variable to track which item's menu is currently open

  activeMediaMode: MediaMode = 'media';

  // Neighbor IDs
  prevId: number | null = null;
  nextId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private itemService: ItemService,
    private tagFilterService: TagFilterService,
    private cdRef: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.route.paramMap.pipe(
        // Step 1: Extract ID and Reset UI State
        map(params => Number(params.get('id'))),
        tap(itemId => {
          if (isNaN(itemId)) {
            this.router.navigate(['/']);
            return;
          }
          this.loading = true;
          this.item = null;
          this.prevId = null;
          this.nextId = null;
          this.cdRef.markForCheck();
        }),

        // Step 2: Single API call handles everything (Item + Neighbors)
        switchMap(itemId => {
          if (isNaN(itemId)) return of(null);

          // Pass active filters/ordering so Django calculates the correct neighbors
          return this.loadItemDetails(itemId).pipe(
            catchError(err => {
              console.error('Error loading item:', err);
              return of(null);
            }),
            finalize(() => {
              this.loading = false;
              this.cdRef.markForCheck();
            })
          );
        })
      ).subscribe();
    }
  }

  // --- Core Loading Methods ---

  // Method to load item details
  private loadItemDetails(itemId: number) {
    this.activeTagFilters = this.tagFilterService.currentFilters;
    return this.itemService.getItem(itemId, this.activeTagFilters).pipe(
      map((item: ItemInterface) => {
        // 1. Flatten Link & FileGroup details safely
        if (item.link_details) {
          item.url = item.link_details.url;
          item.url_domain = item.link_details.url_domain;
          item.media_urls = item.link_details.media_urls;
        }

        if (item.file_group_details) {
          item.files = item.file_group_details.files;
        }

        // 2. Process URLs (this returns SafeItemInterface)
        return this.processItemUrls(item);
      }),
      tap((safeItem: SafeItemInterface) => {
        // 3. Handle Side Effects (Assigning to local variable and CD)
        this.item = safeItem;
        this.prevId = (safeItem as any).prev_id;
        this.nextId = (safeItem as any).next_id;
        this.cdRef.markForCheck();
      })
    );
  }

  private loadNeighbors(itemId: number) {
    this.activeTagFilters = this.tagFilterService.currentFilters;

    return this.itemService.getItemNeighbors(itemId, this.activeTagFilters).pipe(
      map((data: ItemNeighbors) => {
        this.prevId = data.prev_id;
        this.nextId = data.next_id;
        return data;
      }),
      catchError(err => {
        console.error('Failed to load item neighbors:', err);
        this.prevId = null;
        this.nextId = null;
        return of({ prev_id: null, next_id: null } as ItemNeighbors);
      })
    );
  }

  // --- Utility Methods ---

  private processItemUrls(item: ItemInterface): SafeItemInterface {
    const safeItem = item as SafeItemInterface;
    // 1. Initialize Carousel State
    safeItem.currentIndex = 0;

    // 2. Process the main Item Source URL (The "Open Source" link)
    if (item.url) {
      safeItem.safe_url = this.sanitizer.bypassSecurityTrustUrl(item.url);
    }
    // 3. Process the Multiple Media URLs array
    if (item.media_urls && item.media_urls.length > 0) {
      safeItem.safe_media_urls = item.media_urls.map((m: MediaURL) => {
        const safeMedia: SafeMediaURL = { ...m };

        let hdUrl = m.hd_url
        let sdUrl = m.sd_url

        // Apply Proxy Logic for specific video domains
        const proxyDomains = ['media.redgifs.com', 'video.twimg.com', 'i.imgur.com'];
        if (m.media_type === 'video' && proxyDomains.includes(m.hd_url_domain)) {
          hdUrl = `${environment.apiUrl}/proxy-media/?url=${encodeURIComponent(hdUrl)}`;
        }
        if (m.media_type === 'video' && proxyDomains.includes(m.sd_url_domain)) {
          sdUrl = `${environment.apiUrl}/proxy-media/?url=${encodeURIComponent(sdUrl)}`;
        }

        // Sanitize both HD and SD versions
        safeMedia.safe_hd_url = this.sanitizer.bypassSecurityTrustResourceUrl(hdUrl);
        safeMedia.safe_sd_url = this.sanitizer.bypassSecurityTrustResourceUrl(sdUrl);

        return safeMedia;
      });
      this.activeMediaMode = "media"; // To automatically switch to media mode if media url is present
    }
    else {
      this.activeMediaMode = "files"; // To automatically switch to files mode if no media url is present
    }
    // 4. Process file url
    if (item.files && item.files.length > 0) {
      safeItem.safe_files = item.files.map((f: FileInterface) => {
        const safeFile: SafeFile = { ...f };

        const fileUrl: string = `${environment.apiUrl}/files/${f.id}/serve/`
        safeFile.safe_file_serve_url = this.sanitizer.bypassSecurityTrustUrl(fileUrl);

        return safeFile;
      });

    }

    return safeItem
  }

  goToPrev(): void {
    if (this.prevId !== null) {
      this.navigateToItem(this.prevId);
    }
  }

  goToNext(): void {
    if (this.nextId !== null) {
      this.navigateToItem(this.nextId);
    }
  }

  private navigateToItem(itemId: number): void {
    this.router.navigate(['/item', itemId]);
  }

  toggleTags(): void {
    this.showAllTags = !this.showAllTags;
    this.cdRef.markForCheck();
  }

  // -------- Carousel Methods --------

  // Navigate to the next media item
  nextSlide(item: SafeItemInterface): void {
    const idx = item.currentIndex ?? 0;
    if (item.safe_media_urls && idx < item.safe_media_urls.length - 1) {
      item.currentIndex = idx + 1;
      this.cdRef.markForCheck();
    }
    if (item.safe_files && idx < item.safe_files.length - 1) {
      item.currentIndex = idx + 1;
      this.cdRef.markForCheck();
    }
  }

  // Navigate to the previous media item
  prevSlide(item: SafeItemInterface): void {
    const idx = item.currentIndex ?? 0;
    if (idx > 0) {
      item.currentIndex = idx - 1;
      this.cdRef.markForCheck();
    }
  }

  // -------- Item Option Methods --------

  // Method to toggle the options menu
  toggleOptions(itemId: number, event: Event): void {
    // Prevent the click from propagating and closing the menu immediately
    event.stopPropagation();

    // Toggle the state: If the same menu is clicked, close it. Otherwise, open it.
    this.activeOptionsMenuId = this.activeOptionsMenuId === itemId ? null : itemId;
    this.cdRef.markForCheck();
  }

  // Method to handle "Use as Template" action
  useAsTemplate(item: ItemInterface): void {
    // Ensure the tags exist and join them into a comma-separated string for URL passing
    const tagsString = item.tags ? item.tags.join(',') : '';

    // Closes the menu
    this.activeOptionsMenuId = null;
    this.cdRef.markForCheck();

    // Navigates to the add page, passing the tags as a query parameter
    this.router.navigate(['/add'], {
      queryParams: { templateTags: tagsString, dateOfOrigin: item.date_of_origin }
    });
  }

  // Method to handle "Open Item" action
  openItem(item: ItemInterface): void {
    // Closes the menu
    this.activeOptionsMenuId = null;

    // Navigates to the edit route using the item's ID
    if (item.id) {
      this.router.navigate(['/item', item.id]);
      // const urlSegments = this.router.createUrlTree(['/edit', item.id]);
      // const url = this.router.serializeUrl(urlSegments);
      // window.open(url, '_blank')
    } else {
      console.error('Cannot open item: ID is missing.', item);
      // Optional: Show a user-friendly error message
    }
  }

  // Method to handle "Edit Item" action
  editItem(item: ItemInterface): void {
    // 1. Close the dropdown menu
    this.activeOptionsMenuId = null;

    // 2. Navigate to the edit route using the item's ID
    if (item.id) {
      this.router.navigate(['/edit', item.id]);
      // const urlSegments = this.router.createUrlTree(['/edit', item.id]);
      // const url = this.router.serializeUrl(urlSegments);
      // window.open(url, '_blank')
    } else {
      console.error('Cannot edit item: ID is missing.', item);
      // Optional: Show a user-friendly error message
    }
  }

  // Method to open current media
  openCurrentMedia(item: SafeItemInterface) {
    const index = item.currentIndex ?? 0;
    let url: any;

    if (this.activeMediaMode === 'media') {
      url = item.safe_media_urls?.[index]?.safe_hd_url;
    } else {
      url = item.safe_files?.[index]?.safe_file_serve_url;
    }

    if (url) {
      this.openSafeUrl(url);
    }
    else {
      this.activeOptionsMenuId = null; // Close the menu
      this.cdRef.markForCheck();
    }
  }

  // Method to safely opens the external URL in a new tab
  openSafeUrl(safeUrl: any): void {
    this.activeOptionsMenuId = null; // Close the menu

    if (!safeUrl) {
      console.error('URL is missing or unsafe.');
      return;
    }

    const urlString = safeUrl.changingThisBreaksApplicationSecurity || safeUrl.toString();

    // Opens the URL in a new window/tab
    window.open(urlString, '_blank');

    this.cdRef.markForCheck();
  }

  // Method to toggle media mode
  toggleMediaMode() {
    this.activeMediaMode = this.activeMediaMode === 'media' ? 'files' : 'media';
    // Reset index to 0 so we don't end up on a non-existent slide in the other mode
    if (this.item) {
      this.item.currentIndex = 0;
    }

    // Closes the menu
    this.activeOptionsMenuId = null;
    this.cdRef.markForCheck();
  }

}
