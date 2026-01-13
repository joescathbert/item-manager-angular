import { Component, OnInit,ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

// Re-use interfaces and services
import { ItemPayload, LinkPayload } from '../interfaces/item';
import { Item as ItemInterface, SafeItem as SafeItemInterface, MediaURL, SafeMediaURL} from '../interfaces/item';
import { Item as ItemService } from '../services/item';
import { Toast as ToastService } from '../services/toast';
import { Add } from '../add/add';

import { environment } from '../../environments/environment';

@Component({
  selector: 'app-edit',
  standalone: true,
  templateUrl: '../add/add.html', 
  styleUrl: '../add/add.scss',
  imports: [CommonModule, FormsModule, ReactiveFormsModule], 
  providers: [ItemService] 
})
// Extend the Add class and implement OnInit
export class Edit extends Add implements OnInit {

  // Variable to hold the original Item data being edited
  // Store the original URL for comparison during update
  private originalUrl: string = '';

  // Set custom values for the parent's protected properties
  protected override isEditing: boolean = true;
  protected override headerText: string = 'Edit Item';
  protected override submitButtonText: string = 'Update Item';


  // Must re-inject everything the Add component uses, plus ActivatedRoute for ID
  constructor(
    protected override fb: FormBuilder, // 'override' is necessary when property is used in super()
    protected override itemService: ItemService,
    protected override router: Router,
    protected override route: ActivatedRoute,
    protected override toastService: ToastService,
    protected override cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {
    // Call the parent (Add) constructor with inherited services
    super(fb, itemService, router, route, toastService, cdr);
  }

  // Override ngOnInit to handle fetching existing data
  override ngOnInit(): void {
    // 1. Initialize the form structure using the parent's logic
    // This calls Add.ngOnInit(), which sets up addItemForm, loads tags, and handles templates (optional)
    super.ngOnInit(); 

    // 2. Read the item ID from the URL (e.g., /edit/123)
    this.route.paramMap.subscribe(params => {
      const itemId = params.get('id');
      if (itemId) {
        this.loadItemData(Number(itemId));
      } else {
        // Handle error: No ID provided, redirect home
        this.router.navigate(['/home']);
      }
    });

    // NOTE: We don't call super.handleTemplateTags() here, but since it's called 
    // inside super.ngOnInit(), we should rely on that or remove it from the parent's ngOnInit 
    // if template functionality is not desired on the Edit page.
  }

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

      // Fallback for legacy: set the first media as the primary safe_media_url
      safeItem.safe_media_url = safeItem.safe_media_urls[0].safe_hd_url;
    }

    return safeItem
  }

  // Method to fetch and pre-fill the form
  private loadItemData(itemId: number): void {
    this.itemService.getItem(itemId).pipe(
      // 1. Get the Item.
      mergeMap((item: ItemInterface) => {
        this.editedItem = item;

        // 2. Check if it's a link and has a link_id
        if (item.link_id) {
          // If yes, fetch the Link record, which contains the exact URL.
          return this.itemService.getLink(item.link_id).pipe(
            map(link => ({ ...item,
              url: link.url, url_domain: link.url_domain,
              media_url: link.media_url, media_url_domain: link.media_url_domain, media_urls: link.media_urls }))
          );
        }

        // If no link, just return the item object.
        return of(item); 
      })
    ).subscribe({
      next: (processedItem: (ItemInterface)) => {
        // 3. Pre-fill the form fields using the collected data
        this.editedItem = this.processItemUrls(processedItem);
        const itemUrl = (processedItem as any).url || '';
        this.originalUrl = itemUrl
        this.addItemForm.patchValue({
          name: this.editedItem.name,
          // Use the URL from the Link record if available, otherwise assume URL is on Item or empty
          url: itemUrl, 
          dateOfOrigin: this.editedItem.date_of_origin 
        });

        // 4. Pre-fill and manage tags
        this.tags = this.editedItem.tags.sort() || [];
        this.filterSuggestions();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load item data for editing:', err);
        alert('Error: Item not found or failed to load.');
        this.router.navigate(['/home']);
      }
    });
  }

  // 🚨 OVERRIDE: Change the submission logic from create (in Add) to update (in Edit) 🚨
  override onSubmit(): void {
    if (this.addItemForm.invalid || this.tags.length === 0) {
      alert(this.addItemForm.invalid ? 'Please fill out all required fields.' : 'Please add at least one tag.');
      return;
    }

    // Ensure we have the item we're editing
    if (!this.editedItem) {
        alert('Error: Cannot update item, original data missing.');
        return;
    }

    this.loading = true;
    const { name, url, dateOfOrigin } = this.addItemForm.value;

    this.updateItemAndLink(name, url, dateOfOrigin, this.tags, this.editedItem);
  }

  // Update API method
  private updateItemAndLink(name: string, url: string, dateOfOrigin: string, tags: string[], originalItem: SafeItemInterface): void {
    const itemId = originalItem.id;
    const linkId = originalItem.link_id; 
    const itemType = originalItem.type; 

    const itemPayload: ItemPayload = {
      name: name,
      type: itemType, 
      date_of_origin: dateOfOrigin,
      tag_names: tags
    };

    // CHECK: Has the URL changed?
    const urlChanged = url !== this.originalUrl;

    // CHECK: Is the URL field empty now, but it had a link before? (Means delete)
    const urlRemoved = linkId && url === '';

    // 1. Update the Item record (tags, name, date)
    this.itemService.updateItem(itemId, itemPayload).pipe(
      // 2. If item update succeeds, update the Link record (required for URL changes)
      mergeMap(() => {
        if (linkId) {
          // A. Link exists: check if it needs updating or removal
          if (urlChanged && url) {
            // URL has changed and is NOT empty: UPDATE link
            const linkPayload: LinkPayload = {
              item: itemId,
              url: url
            };
            return this.itemService.updateLink(linkId, linkPayload);
          } else if (urlRemoved) {
            // URL is now empty: DELETE link
            return this.itemService.deleteLink(linkId);
          }
          // URL hasn't changed or was just removed: no API call needed.
          return of(null); 

        } else if (url) {
          // B. Link did NOT exist: but form now has a URL: CREATE link
          const linkPayload: LinkPayload = {
            item: itemId,
            url: url
          };
          return this.itemService.createLink(linkPayload);
        }

        // If no link action is needed, complete the observable chain
        return of(null);
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        this.toastService.showSuccess('Item updated.');
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading = false;
        console.error('Update failed:', err);
        this.toastService.showError('Failed to update item.');
        this.router.navigate(['/home']);
      }
    });
  }

}
