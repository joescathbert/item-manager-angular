import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Inject } from '@angular/core';
import { map, mergeMap } from 'rxjs/operators';
import { of, forkJoin, Subscription} from 'rxjs';
import { ChangeDetectorRef, ChangeDetectionStrategy, ApplicationRef} from '@angular/core';
import { Item as ItemService } from '../services/item';
import { Item as ItemInterface } from '../interfaces/item';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';


declare var twttr: any;

@Component({
  selector: 'app-home',
  imports: [InfiniteScrollDirective],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  // Page and Item Variables
  items: (ItemInterface)[] = [];
  page = 1;
  loading = false;
  hasNextPage: boolean = true; // Tracks if the 'next' link is present
  private nextUrlSubscription!: Subscription; // To manage the subscription

  // Deletion Confirmation Overlay Variables
  showDeleteConfirmation: boolean = false;
  itemToDelete: ItemInterface | null = null; // Stores the item awaiting confirmation

  // Variable to track which item's menu is currently open
  activeOptionsMenuId: number | null = null;

  constructor(
    private itemService: ItemService, 
    private router: Router, 
    private cdRef: ChangeDetectorRef, 
    private appRef: ApplicationRef,
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

  loadItems() {
    if (this.loading || !this.hasNextPage) return;
    this.loading = true;

    this.itemService.getItems(this.page).pipe(
      mergeMap((data: ItemInterface[]) => {
        const itemObservables = data.map(item => {
          if (item.type === 'link' && item.link_id) {
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
        this.items = [...this.items, ...processedItems];
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

  confirmDelete(item: ItemInterface): void {
      this.itemToDelete = item;
      this.showDeleteConfirmation = true;
      this.cdRef.markForCheck();
  }

  // 🚨 NEW: Method to cancel deletion and close overlay
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

        // 🚨 CRITICAL: Close overlay and reset state after successful deletion
        this.cancelDelete();
        
        this.cdRef.markForCheck();
        this.appRef.tick();
      },
      error: (err) => {
        console.error(`Failed to delete item ${itemToDeleteId}:`, err);
        alert('Failed to delete item. Please try again.');
        this.cancelDelete(); // Also close on error
      }
    });
  }

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
      queryParams: { templateTags: tagsString }
    });
  }

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


  testPrint() {
    console.log('Current items:', this.items);
  }
}
