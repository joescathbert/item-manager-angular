import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Inject } from '@angular/core';
import { map, mergeMap } from 'rxjs/operators';
import { of, forkJoin, Subscription} from 'rxjs';
import { ChangeDetectorRef, ChangeDetectionStrategy, ApplicationRef} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { Item as ItemService } from '../services/item';
import { Toast as ToastService } from '../services/toast';
import { Item as ItemInterface } from '../interfaces/item';
import { environment } from '../../environments/environment';


declare var twttr: any;

interface SafeItemInterface extends ItemInterface {
    safe_media_url?: SafeResourceUrl;
}

@Component({
  selector: 'app-home',
  imports: [InfiniteScrollDirective],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  // Page and Item Variables
  items: SafeItemInterface[] = [];
  page = 1;
  loading = false;
  hasNextPage: boolean = true; // Tracks if the 'next' link is present
  private nextUrlSubscription!: Subscription; // To manage the subscription

  // Deletion Confirmation Overlay Variables
  showDeleteConfirmation: boolean = false;
  itemToDelete: ItemInterface | null = null; // Stores the item awaiting confirmation

  // Variable to track which item's menu is currently open
  activeOptionsMenuId: number | null = null;

  // Variable store the tags currently being filtered
  activeFilters: string[] = [];

  constructor(
    private itemService: ItemService, 
    private router: Router, 
    private cdRef: ChangeDetectorRef, 
    private appRef: ApplicationRef,
    private sanitizer: DomSanitizer,
    private toastService: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // RESET SERVICE STATE (MUST BE IMPLEMENTED IN SERVICE)
      this.itemService.resetPagination(); 

      // RESET COMPONENT STATE
      this.items = [];
      this.page = 1;
      this.loading = false;
      this.hasNextPage = true; 
      this.activeFilters = [];

      // Load Items
      this.loadItems();
      this.nextUrlSubscription = this.itemService.nextUrl$.subscribe(nextUrl => {
        this.hasNextPage = !!nextUrl;
        this.cdRef.markForCheck();
    });
    }
  }

  ngOnDestroy() {
    // Clean up the subscription when the component is destroyed
    if (isPlatformBrowser(this.platformId)) {
      this.nextUrlSubscription.unsubscribe();
    }
  }

  private processItemUrls(item: ItemInterface): SafeItemInterface {

    if (item.media_url && item.media_url_domain === 'media.redgifs.com') {
      // 🚨 CRITICAL: Construct the local proxy URL 🚨
      // Ensure this path matches the Django URL pattern you defined
      const proxyUrl = `${environment.apiUrl}/proxy-media/?url=${encodeURIComponent(item.media_url)}`;

      // Sanitize the local proxy URL (which is safe)
      (item as SafeItemInterface).safe_media_url = 
        this.sanitizer.bypassSecurityTrustResourceUrl(proxyUrl);
    }
    else if (item.media_url) {
      // For other media URLs, sanitize them directly
      (item as SafeItemInterface).safe_media_url = 
        this.sanitizer.bypassSecurityTrustResourceUrl(item.media_url);
    }

    return item as SafeItemInterface;
  }

  loadItems() {
    if (this.loading || !this.hasNextPage) return;
    this.loading = true;

    this.itemService.getItems(this.page, this.activeFilters).pipe(
      mergeMap((data: ItemInterface[]) => {
        const itemObservables = data.map(item => {
          if (item.link_id) {
            return this.itemService.getLink(item.link_id).pipe(
              map(link => ({ ...item,
                url: link.url, url_domain: link.url_domain,
                media_url: link.media_url, media_url_domain: link.media_url_domain }))
            );
          } else {
            return of(item);
          }
        });
        return forkJoin(itemObservables); 
      })
    ).subscribe({
      next: (processedItems: (ItemInterface & { url?: string })[]) => {
        console.log(`Loaded ${processedItems.length} items for page ${this.page}`);
        console.log(processedItems);
        this.items = [
          ...this.items, 
          ...processedItems.map(item => this.processItemUrls(item))
        ];
        this.page++;
        this.cdRef.markForCheck();
        this.appRef.tick();
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.loading = false;
        this.cdRef.markForCheck();
      },
      complete: () => {
        this.loading = false;
        console.log('Finished loading items.');
        if (typeof twttr !== 'undefined') {
          setTimeout(() => {
            twttr.ready(() => {
              twttr.widgets.load();
            });
          }, 150);
          console.log('Twitter widgets reloaded.');
        }
      }
    });
  }

  // Method to handle scroll event
  onScroll() {
    console.log('--- SCROLL EVENT TRIGGERED ---');
    this.loadItems();
  }

  // -------- Item Deletion Methods --------
  confirmDelete(item: ItemInterface): void {
    this.itemToDelete = item;
    this.showDeleteConfirmation = true;
    this.cdRef.markForCheck();
  }

  // Method to cancel deletion and close overlay
  cancelDelete(): void {
    this.showDeleteConfirmation = false;
    this.itemToDelete = null;
    this.cdRef.markForCheck();
  }

  deleteItem(): void {
    // Use the item stored in itemToDelete
    if (!this.itemToDelete) return; 

    const itemToDeleteId = this.itemToDelete.id;

    this.itemService.deleteItem(itemToDeleteId).subscribe({
      next: () => {
        console.log(`Item ${itemToDeleteId} deleted successfully.`);
        this.items = this.items.filter(item => item.id !== itemToDeleteId);

        // Close overlay and reset state after successful deletion
        this.toastService.showSuccess('Item deleted.')
        this.cancelDelete();

        this.cdRef.markForCheck();
        this.appRef.tick();
      },
      error: (err) => {
        console.error(`Failed to delete item ${itemToDeleteId}:`, err);
        this.toastService.showError('Failed to delete item. Please try again.');
        this.cancelDelete(); // Also close on error
      }
    });
  }

  // -------- Item Option Methods --------
  // Method to toggle the options menu
  toggleOptions(itemId: number, event: Event): void {
    console.log(`Toggling options menu for item ID: ${itemId}`);
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

    // 1. Close the menu
    this.activeOptionsMenuId = null;
    this.cdRef.markForCheck();

    // 2. Navigate to the add page, passing the tags as a query parameter
    this.router.navigate(['/add'], {
      queryParams: { templateTags: tagsString, dateOfOrigin: item.date_of_origin }
    });
  }

  // Method to handle "Edit Item" action
  editItem(item: ItemInterface): void {
    // 1. Close the dropdown menu
    this.activeOptionsMenuId = null; 
    
    // 2. Navigate to the edit route using the item's ID
    if (item.id) {
        this.router.navigate(['/edit', item.id]);
    } else {
        console.error('Cannot edit item: ID is missing.', item);
        // Optional: Show a user-friendly error message
    }
  }

  // Method to safely opens the external URL in a new tab
  openMediaUrl(safeUrl: any): void {
    this.activeOptionsMenuId = null; // Close the menu

    if (!safeUrl) {
      console.error('URL is missing or unsafe.');
      return;
    }

    // Since safeUrl is a SafeResourceUrl object, we access the string value 
    // using the 'toString()' method or by accessing the private value (less ideal, but sometimes necessary).
    // The most reliable way, assuming correct sanitization, is often to coerce it.
    
    // Attempt to extract the URL string:
    // If you are using TypeScript 4.4+ and have configured things strictly, 
    // you might need to use type assertion or check the structure.

    // A quick way that works for most SafeUrl objects in templates:
    const urlString = safeUrl.changingThisBreaksApplicationSecurity || safeUrl.toString();

    // Open the URL in a new window/tab
    window.open(urlString, '_blank');
    
    this.cdRef.markForCheck();
  }

  // -------- Tag Filter Methods --------

  // Adds a tag to the active filters if not present and triggers a fresh item load.
  addFilterTag(tag: string): void {
    if (!this.activeFilters.includes(tag)) {
      this.activeFilters = [...this.activeFilters, tag];
      this.resetAndLoadItems();
      // Close any open options menu when filtering starts
      this.activeOptionsMenuId = null; 
    }
  }

  // Removes a tag from the active filters and triggers a fresh item load.
  removeFilterTag(tag: string): void {
    this.activeFilters = this.activeFilters.filter(t => t !== tag);
    this.resetAndLoadItems();
  }

  // Clears all active filters and triggers a fresh item load.
  clearFilters(): void {
    if (this.activeFilters.length > 0) {
      this.activeFilters = [];
      this.resetAndLoadItems();
    }
  }

  // Resets the component/service pagination state and reloads items with the current filters.
  private resetAndLoadItems(): void {
    // 1. Reset component state for a fresh API call
    this.items = [];
    this.page = 1;
    this.hasNextPage = true;
    this.loading = false; 

    // 2. Reset service pagination state
    this.itemService.resetPagination(); 

    // 3. Load items with the new filter
    this.loadItems();
    this.cdRef.markForCheck(); // Ensure the view updates
  }

  testPrint() {
    console.log('Current items:', this.items);
  }
}
