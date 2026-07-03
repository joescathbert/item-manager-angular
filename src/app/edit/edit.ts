import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, mergeMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';

// Re-use interfaces and services
import { ItemPayload, LinkPayload } from '../interfaces/item';
import { Item as ItemInterface, SafeItem as SafeItemInterface, MediaURL, SafeMediaURL, SafeFile, File as FileInterface } from '../interfaces/item';
import { Item as ItemService } from '../services/item';
import { Tag as TagService } from '../services/tag';
import { Toast as ToastService } from '../services/toast';
import { Add } from '../add/add';
import { MediaMode } from '../interfaces/misc';

import { Logger } from '../services/logger';
import { environment } from '../../environments/environment';
import { VideoObserver } from '../directives/video-observer';



@Component({
  selector: 'app-edit',
  standalone: true,
  templateUrl: '../add/add.html',
  styleUrl: '../add/add.scss',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, VideoObserver],
  providers: [ItemService],
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
  protected override activeMediaMode: MediaMode = 'media';


  // Must re-inject everything the Add component uses
  constructor(
    protected override fb: FormBuilder, // 'override' is necessary when property is used in super()
    protected override itemService: ItemService,
    protected override tagService: TagService,
    protected override router: Router,
    protected override route: ActivatedRoute,
    protected override toastService: ToastService,
    protected override cdr: ChangeDetectorRef,
    protected override logger: Logger,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Call the parent (Add) constructor with inherited services
    super(fb, itemService, tagService, router, route, toastService, cdr, logger);
  }

  // Override ngOnInit to handle fetching existing data
  override ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      
      // Execute parent initialization ONLY on the client side where tokens exist
      super.ngOnInit();

      // Read the item ID from the URL safely
      this.route.paramMap.subscribe(params => {
        const itemId = params.get('id');
        if (itemId) {
          this.loadItemData(Number(itemId));
        } else {
          console.warn('No valid ID parameter detected in URL.');
          this.router.navigate(['/home']);
        }
      });

    } else {
      // While running on the Node server (SSR), safely bypass compilation tracking
      this.logger.log('Bypassing secure state compilation on Node runtime.');
    }
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

  // Method to fetch and pre-fill the form
  private loadItemData(itemId: number): void {
    this.itemService.getItem(itemId).pipe(
      map((item: ItemInterface) => {
        // 1. Flatten Link & FileGroup details safely (just like loadItemDetails)
        if (item.link_details) {
          item.url = item.link_details.url;
          item.url_domain = item.link_details.url_domain;
          item.media_urls = item.link_details.media_urls;
        }

        if (item.file_group_details) {
          item.files = item.file_group_details.files;
        }

        // 2. Return processed item
        return this.processItemUrls(item);
      }),
      tap((finalItem: SafeItemInterface) => {
        // 3. Side effects: Update local state and the form
        this.editedItem = finalItem;
        this.originalUrl = finalItem.url || '';

        this.addItemForm.patchValue({
          name: finalItem.name,
          url: this.originalUrl,
          dateOfOrigin: finalItem.date_of_origin
        });

        // 4. Update tags and UI
        this.tags = [...(finalItem.tags || [])].sort();
        this.filterSuggestions();
        this.cdr.detectChanges();
      })
    ).subscribe({
      error: (err) => {
        console.error('Failed to load item data for editing:', err);
        this.router.navigate(['/home']);
      }
    });
  }

  // Method to submit while in edit mode
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

    this.updateItemAndLinkAndFile(
      name,
      url,
      dateOfOrigin,
      this.tags,
      this.editedItem,
      this.selectedFiles,
      this.selectedFileTypes
    );
  }

  // Method to toggle media mode
  override toggleMediaMode() {
    this.activeMediaMode = this.activeMediaMode === 'media' ? 'files' : 'media';
    // Reset index to 0 so we don't end up on a non-existent slide in the other mode
    if (this.editedItem) {
      this.editedItem.currentIndex = 0;
    }
  }

  // Method to preview fle
  override previewFile(fileIndex: number): void {
    this.activeMediaMode = 'files';
    if (this.editedItem) {
      this.editedItem.currentIndex = fileIndex;
      window.scrollTo({
        top: 50,
        left: 0,
        behavior: 'smooth'
      });
    }
  }

  // Update API method
  private updateItemAndLinkAndFile(
    name: string,
    url: string,
    dateOfOrigin: string,
    tags: string[],
    originalItem: SafeItemInterface,
    files: File[] = [],
    fileTypes: string[] = []
  ): void {
    const itemId = originalItem.id;
    const linkId = originalItem.link_id;
    const itemType = originalItem.type;
    const hasFiles = files.length > 0;

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
        let linkAction$ = of(null);

        if (linkId) {
          // A. Link exists: check if it needs updating or removal
          if (urlChanged && url) {
            // URL has changed and is NOT empty: UPDATE link
            const linkPayload: LinkPayload = {
              item: itemId,
              url: url
            };
            linkAction$ = this.itemService.updateLink(linkId, linkPayload);
          } else if (urlRemoved) {
            // URL is now empty: DELETE link
            linkAction$ = this.itemService.deleteLink(linkId);
          }
        } else if (url) {
          // B. Link did NOT exist: but form now has a URL: CREATE link
          const linkPayload: LinkPayload = {
            item: itemId,
            url: url
          };
          linkAction$ = this.itemService.createLink(linkPayload);
        }

        return linkAction$.pipe(
          mergeMap(() => {
            if (hasFiles) {
              return this.itemService.uploadFilesToItem(itemId, files, fileTypes);
            }
            return of(null);
          })
        );
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        this.toastService.showSuccess('Item updated.');
        this.router.navigate(['/item', itemId]);
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
