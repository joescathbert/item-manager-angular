import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { Item as ItemService } from '../services/item';
import { TagFilter as TagFilterService } from '../services/tag-filter';
import { Item as ItemInterface, SafeItem as SafeItemInterface, ItemNeighbors } from '../interfaces/item';
import { environment } from '../../environments/environment';
import { VideoObserver } from '../directives/video-observer';
import { switchMap, catchError, mergeMap, map, finalize } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';


@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [RouterModule, VideoObserver],
  templateUrl: './item-detail.html',
  styleUrl: './item-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush, 
})
export class ItemDetail implements OnInit {
  // Current Item data
  item: SafeItemInterface | null = null;
  loading = true; // Initialize to true to show loading state

  activeTagFilters: string[] = []; // Variable to store the tags currently being filtered

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
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Subscribe to route parameter changes (e.g., when clicking Prev/Next)
      this.route.paramMap.pipe(
        // Step 1: Reset state and get ID
        map(params => {
          this.loading = true;
          this.item = null;
          this.prevId = null;
          this.nextId = null;
          this.cdRef.markForCheck(); // Show loading/reset state immediately
          return params.get('id');
        }),
        // Step 2: Use switchMap to cancel old requests and start new ones
        switchMap(id => {
          const itemId = Number(id);
          if (isNaN(itemId)) {
            this.router.navigate(['/']);
            return of(null);
          }

          // Step 3: Load Item Details and Neighbors concurrently using forkJoin
          return forkJoin([
            this.loadItemDetails(itemId),
            this.loadNeighbors(itemId)
          ]).pipe(
            catchError(err => {
              console.error('Error loading item or neighbors:', err);
              return of(null); 
            }),
            // Step 4: Ensure loading is set to false and view is checked after all API calls complete
            finalize(() => {
              this.loading = false;
              console.log(this.nextId, this.prevId);
              this.cdRef.markForCheck(); 
            })
          );
        })
      ).subscribe();
    }
  }

  // --- Core Loading Methods ---

  private loadItemDetails(itemId: number) {
    return this.itemService.getItem(itemId).pipe(
      // Maps to fetch Link details if needed
      mergeMap((item: ItemInterface) => {
        if (item.link_id) {
          return this.itemService.getLink(item.link_id).pipe(
            map(link => ({ 
              ...item,
              url: link.url, url_domain: link.url_domain,
              media_url: link.media_url, media_url_domain: link.media_url_domain 
            }))
          );
        } else {
          return of(item);
        }
      }),
      // Final processing and side effects
      map((processedItem: ItemInterface) => this.processItemUrls(processedItem)),
      map((safeItem: SafeItemInterface) => {
        this.item = safeItem;
        this.cdRef.markForCheck();
        return safeItem; 
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
    if (item.url && item.media_url && ['media.redgifs.com', 'video.twimg.com', 'i.imgur.com'].includes(item.media_url_domain ?? "")) {
      const proxyUrl = `${environment.apiUrl}/proxy-media/?url=${encodeURIComponent(item.media_url)}`;
      (item as SafeItemInterface).safe_media_url = this.sanitizer.bypassSecurityTrustResourceUrl(proxyUrl);
      (item as SafeItemInterface).safe_url = this.sanitizer.bypassSecurityTrustUrl(item.url);
    }
    else if (item.url && item.media_url) {
      (item as SafeItemInterface).safe_media_url = this.sanitizer.bypassSecurityTrustResourceUrl(item.media_url);
      (item as SafeItemInterface).safe_url = this.sanitizer.bypassSecurityTrustUrl(item.url);
    }
    return item as SafeItemInterface;
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
    console.log(`Navigating to item ID: ${itemId}`);
    this.router.navigate(['/item', itemId]);
  }

}
