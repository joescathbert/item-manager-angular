import { Component } from '@angular/core';
import { Router } from '@angular/router';
// import { NavigationEnd } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Inject } from '@angular/core';
import { map, mergeMap } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import { ChangeDetectorRef, ChangeDetectionStrategy, ApplicationRef} from '@angular/core';
import { ItemService } from '../services/item';
import { Item } from '../interfaces/item';
import {  } from '@angular/core';


declare var twttr: any;

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  items: (Item)[] = [];
  page = 1;
  loading = false;

  constructor(
    private itemService: ItemService, 
    private router: Router, 
    private cdRef: ChangeDetectorRef, 
    private appRef: ApplicationRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadItems();
    }
    // ✅ reload items if redirected to /home again
    // this.router.events.subscribe(event => {
    //   if (event instanceof NavigationEnd && event.urlAfterRedirects === '/home') {
    //     this.resetAndLoad();
    //   }
    // });
  }

  loadItems() {
    if (this.loading) return;
    this.loading = true;

    this.itemService.getItems(this.page).pipe(
      mergeMap((data: Item[]) => {
        const itemObservables = data.map(item => {
          if (item.type === 'link' && item.link_id) {
            return this.itemService.getLink(item.link_id).pipe(
              map(link => ({ ...item, url: link.url }))
            );
          } else {
            return of(item); 
          }
        });
        return forkJoin(itemObservables); 
      })
    ).subscribe({
      next: (processedItems: (Item & { url?: string })[]) => {
        console.log(`Loaded ${processedItems.length} items for page ${this.page}`);
        console.log(processedItems);
        this.items.push(...processedItems); 
        this.page++;
        this.cdRef.markForCheck();
        this.appRef.tick();
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.loading = false;
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
        }
      }
    });
  }

  deleteItem(itemToDelete: Item): void {
    this.itemService.deleteItem(itemToDelete.id).subscribe({
      next: () => {
        console.log(`Item ${itemToDelete.id} deleted successfully.`);
        this.items = this.items.filter(item => item.id !== itemToDelete.id);
        this.cdRef.markForCheck();   // ✅ tell Angular to re-check
        this.appRef.tick();          // optional, forces full app refresh
      },
      error: (err) => {
        console.error(`Failed to delete item ${itemToDelete.id}:`, err);
        alert('Failed to delete item. Please try again.');
      }
    });
  }

  onScroll() {
    this.loadItems();
  }

  testPrint() {
    console.log('Current items:', this.items);
  }

  // resetAndLoad() {
  //   this.items = [];
  //   this.page = 1;
  //   this.loadItems();
  // }
}
