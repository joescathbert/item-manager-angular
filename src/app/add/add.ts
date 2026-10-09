import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject, DestroyRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule, AbstractControl, ValidatorFn } from '@angular/forms';
import { of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { ItemPayload, SafeItem as SafeItemInterface } from '../interfaces/item';
import { LinkPayload, SafeLinkPreview, UploadPreview, UploadPreviewMedia } from '../interfaces/link';
import { Tag } from '../interfaces/tag';
import { MediaMode } from '../interfaces/misc';
import { Item as ItemService } from '../services/item';
import { Link as LinkService } from '../services/link';
import { Tag as TagService } from '../services/tag';
import { Toast as ToastService } from '../services/toast';

import { Logger } from '../services/logger';

@Component({
  selector: 'app-add',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './add.html',
  styleUrl: './add.scss'
})
export class Add {
  addItemForm!: FormGroup;
  @ViewChild('tagInputField') tagInputField!: ElementRef<HTMLInputElement>;

  tagInput: string = '';
  tags: string[] = [];
  loading: boolean = false; // For submission button state
  // State for suggestions
  allTags: Tag[] = [];
  suggestionTags: Tag[] = [];
  showTagSuggestions: boolean = true;

  selectedFiles: File[] = []; // Property to hold the selected files
  selectedFileTypes: string[] = []; // Property to hold the file types of selected files

  // Protected properties for the child (Edit) component
  protected isEditing: boolean = false;
  protected headerText: string = 'Add New Item';
  protected submitButtonText: string = 'Add Item';
  protected activeMediaMode: MediaMode = 'link';

  protected editedItem: SafeItemInterface = {
    id: 0, // Placeholder ID
    owner: '',
    name: '',
    type: '',
    date_of_origin: '',
    tags: [],
    created_at: '',
    link_id: null,
    link_details: null,
    file_group_id: null,
    file_group_details: null,
    prev_id: null,
    next_id: null,
    media_urls: [],
  };

  protected previewLoading: boolean = false;
  protected previewItem: SafeLinkPreview = { original_url: '', media: [], safe_media: [], currentIndex: 0 };
  protected previewUpload: UploadPreview = { currentIndex: 0, media: [] };

  constructor(
    protected fb: FormBuilder,
    protected itemService: ItemService,
    protected linkService: LinkService,
    protected tagService: TagService,
    protected router: Router,
    protected route: ActivatedRoute,
    protected toastService: ToastService,
    protected cdr: ChangeDetectorRef,
    protected logger: Logger
  ) { }

  // Custom Validator function to enforce URL OR File
  private urlOrFileRequiredValidator: ValidatorFn = (control: AbstractControl): { [key: string]: any } | null => {
    const url = control.get('url')?.value;

    // Accessing `selectedFiles` via the custom validator is tricky as it's outside the form.
    // We will rely on a secondary check in onSubmit() instead of throwing a validation error here.
    // However, we can remove the Validators.required from URL now.
    // The main FormGroup validation will ensure 'name' and 'dateOfOrigin' are there.

    // For now, return null and rely on the onSubmit check for simplicity.
    return null;
  };

  ngOnInit(): void {
    this.addItemForm = this.fb.group({
      name: ['New Item', Validators.required],
      dateOfOrigin: [this.getCurrentDate(), Validators.required],
      url: [''],
      fileDescription: ['']
    }, { validators: this.urlOrFileRequiredValidator });

    // Load all tags when the component initializes
    this.loadAllTags();

    this.handleTemplateTags();
  }

  // Helper method to get today's date in YYYY-MM-DD format for the input default
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // --- Tag Management ---
  addTag() {
    const tagName = this.tagInput.trim();
    if (tagName && !this.tags.includes(tagName)) {
      this.tags.push(tagName);
      this.tagInput = ''; // Clear the input after adding
      this.hideSuggestionsOnce();
    }
  }

  addSuggestedTag() {
    const srcTag: string = this.tagInput.trim();

    // 1. Guard check: Ensure we have input and suggestions to work with
    if (!srcTag || !this.suggestionTags || this.suggestionTags.length === 0) {
      this.tagInput = '';
      this.hideSuggestionsOnce();
      return;
    }

    // 2. Check if the typed text exactly matches ANY available suggestion
    const exactMatch = this.suggestionTags.find(
      tag => tag.name.toLowerCase() === srcTag.toLowerCase()
    );

    // 3. Determine the target tag: Use the exact match if found, otherwise fallback to the first suggestion
    const tagToAdd = exactMatch ? exactMatch.name : this.suggestionTags[0].name;

    // 4. Prevent adding duplicates to your final array
    if (!this.tags.includes(tagToAdd)) {
      this.tags.push(tagToAdd);
    }

    // 5. Clean up UI state
    this.tagInput = '';
    this.hideSuggestionsOnce();
  }

  private hideSuggestionsOnce(): void {
    this.showTagSuggestions = false;
    setTimeout(() => {
      this.showTagSuggestions = true;
      this.filterSuggestions();
    }, 0);
  }

  removeTag(tagToRemove: string) {
    this.tags = this.tags.filter(tag => tag !== tagToRemove);
  }

  // --- Tag Suggestion Management ---
  loadAllTags(): void {
    this.tagService.getTags().subscribe({
      next: (tags: Tag[]) => {
        this.allTags = tags;
        this.suggestionTags = tags; // Initially show all tags
      },
      error: (err) => {
        console.error('Failed to load tags for suggestions:', err);
      }
    });
  }

  // Filters the suggestions based on user input
  filterSuggestions(): void {
    const input = this.tagInput.trim().toLowerCase();
    if (!input) {
      // If input is empty, show all available tags that haven't been selected
      this.suggestionTags = this.allTags.filter(tag => !this.tags.includes(tag.name));
    } else {
      // Filter tags that match the input AND haven't been selected
      this.suggestionTags = this.allTags.filter(tag =>
        tag.name.toLowerCase().includes(input) && !this.tags.includes(tag.name)
      );
    }
  }

  // Handles pre filling tags and date of origin from query parameters
  private handleTemplateTags(): void {
    // We subscribe to queryParams to capture tags and date of origin passed from the Home component
    this.route.queryParams.subscribe(params => {
      const templateTagsString = params['templateTags'];
      const templateDateOfOrigin = params['dateOfOrigin'];

      // If a dateOfOrigin is provided, set it in the form
      if (templateDateOfOrigin) {
        this.addItemForm.patchValue({ dateOfOrigin: templateDateOfOrigin });
      }

      if (templateTagsString) {
        const prefillTags = templateTagsString
          .split(',')
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0);

        // Use the Set object to ensure no duplicates, then merge with existing tags
        this.tags = [...new Set([...this.tags, ...prefillTags])];

        // Remove the query parameter from the URL after it has been used
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { templateTags: null }, // Set the param to null to remove it
          queryParamsHandling: 'merge' // Merge with existing params (if any)
        });

        // Re-filter suggestions to hide the newly added tags
        this.filterSuggestions();
      }
    });
  }

  // Handler for the file input change event
  onFileSelected(event: any): void {
    const files: FileList = event.target.files;

    const newFiles = Array.from(files);
    const newTypes = newFiles.map(() => 'RAW');

    this.selectedFiles = [
      ...this.selectedFiles,
      ...newFiles
    ];

    this.selectedFileTypes = [
      ...this.selectedFileTypes,
      ...newTypes
    ];

    const newMedia: UploadPreviewMedia[] = newFiles
      .filter(file =>
        file.type.startsWith('image/') ||
        file.type.startsWith('video/')
      )
      .map(file => ({
        file,
        file_url: URL.createObjectURL(file),
        media_type: file.type.startsWith('image/')
          ? 'image'
          : 'video'
      }));

    this.previewUpload.media = [
      ...this.previewUpload.media,
      ...newMedia
    ];

    event.target.value = null;
  }

  // Removes a file from the selectedFiles array by index
  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.selectedFileTypes.splice(index, 1);
    this.previewUpload.media.splice(index, 1);

    // Adjust carousel index if deleted item was the last slide
    if (this.previewUpload.currentIndex >= this.previewUpload.media.length) {
      this.previewUpload.currentIndex = Math.max(0, this.previewUpload.media.length - 1);
    }

    this.cdr.markForCheck();
  }

  // Moves a file up in the list (decreases index)
  moveFileUp(index: number): void {
    if (index > 0) {
      // Standard array swap using destructuring
      [this.selectedFiles[index - 1], this.selectedFiles[index]] =
        [this.selectedFiles[index], this.selectedFiles[index - 1]];

      [this.selectedFileTypes[index - 1], this.selectedFileTypes[index]] =
        [this.selectedFileTypes[index], this.selectedFileTypes[index - 1]];

      // Swap Preview Upload
      [this.previewUpload.media[index - 1], this.previewUpload.media[index]] =
        [this.previewUpload.media[index], this.previewUpload.media[index - 1]];
    }
  }

  // Moves a file down in the list (increases index)
  moveFileDown(index: number): void {
    if (index < this.selectedFiles.length - 1) {
      // Standard array swap using destructuring
      [this.selectedFiles[index + 1], this.selectedFiles[index]] =
        [this.selectedFiles[index], this.selectedFiles[index + 1]];

      [this.selectedFileTypes[index + 1], this.selectedFileTypes[index]] =
        [this.selectedFileTypes[index], this.selectedFileTypes[index + 1]];

      // Swap Preview Upload
      [this.previewUpload.media[index + 1], this.previewUpload.media[index]] =
        [this.previewUpload.media[index], this.previewUpload.media[index + 1]];

    }
  }

  // Getter to safely format the file names for display
  public get selectedFileNames(): string {
    if (this.selectedFiles && this.selectedFiles.length > 0) {
      return this.selectedFiles.map(f => f.name).join(', ');
    }
    return '';
  }

  // --- Form Actions ---
  onSubmit() {
    const { name, url, dateOfOrigin, fileDescription } = this.addItemForm.value;

    const trimmedUrl = url?.trim();
    const hasUrl = !!trimmedUrl;
    const hasFiles = this.selectedFiles.length > 0;

    if (this.addItemForm.invalid || this.tags.length === 0 || (!hasUrl && !hasFiles)) {
      let errorMsg = '';
      if (this.addItemForm.invalid) errorMsg = 'Please fill out all required fields.';
      else if (this.tags.length === 0) errorMsg = 'Please add at least one tag.';
      else if (!hasUrl && !hasFiles) errorMsg = 'Please provide a URL OR select at least one file.';

      this.toastService.showError(errorMsg);
      return;
    }

    // If a URL is entered, verify uniqueness first
    if (hasUrl) {
      this.loading = true;
      this.linkService.checkLinkExists(trimmedUrl).subscribe({
        next: (exists: boolean) => {
          if (exists) {
            this.loading = false;
            this.cdr.markForCheck();

            // Native browser confirm or swap with your custom modal/dialog service:
            const proceed = window.confirm(
              'This link already exists in the database. Are you sure you want to add it again?'
            );

            if (!proceed) {
              return;
            }
          }

          // Proceed with final submission
          this.executeSubmission(name, trimmedUrl, dateOfOrigin, fileDescription, hasFiles);
        },
        error: (err) => {
          this.loading = false;
          this.cdr.markForCheck();
          this.logger.error('[Add] Failed to verify link existence:', err);
          // Fallback: Proceed anyway or show toast based on your requirement
          this.executeSubmission(name, trimmedUrl, dateOfOrigin, fileDescription, hasFiles);
        }
      });
    } else {
      // No URL (File-only submission) -> proceed immediately
      this.executeSubmission(name, '', dateOfOrigin, fileDescription, hasFiles);
    }
  }

  /**
   * Dispatches to either file-based or link-based submission
   */
  private executeSubmission(
    name: string,
    url: string,
    dateOfOrigin: string,
    fileDescription: string,
    hasFiles: boolean
  ): void {
    this.loading = true;
    this.cdr.markForCheck();

    if (hasFiles) {
      this.submitItemAndFiles(name, dateOfOrigin, fileDescription);
    } else {
      this.submitItemAndLink(name, url, dateOfOrigin);
    }
  }

  cancel() {
    this.router.navigate(['/home']);
  }

  // Method to toggle preview media mode
  toggleMediaMode() {
    this.activeMediaMode = this.activeMediaMode === 'link' ? 'files' : 'link';
    // Reset index to 0 so we don't end up on a non-existent slide in the other mode
    if (this.previewItem) {
      this.previewItem.currentIndex = 0;
    }
    if (this.previewUpload) {
      this.previewUpload.currentIndex = 0;
    }
  }

  // Placeholder method for the child (Edit) component
  previewFile(fileIndex: number) { }

  previewUploadPreview(fileIndex: number) {
    this.activeMediaMode = this.activeMediaMode === 'link' ? 'files' : 'files';
    if (this.previewUpload.media) {
      this.previewUpload.currentIndex = fileIndex;
    }
  }

  // This method is now safe to be called by the default onSubmit()
  protected submitItemAndLink(name: string, url: string, dateOfOrigin: string): void {
    const itemPayload: ItemPayload = {
      name: name,
      type: 'link',
      date_of_origin: dateOfOrigin,
      tag_names: this.tags
    };

    this.itemService.createItem(itemPayload).pipe(
      // 1. Create the Item. API returns the new item object, including its ID.
      mergeMap((newItem: any) => {
        const newItemId = newItem.id;

        // 2. Prepare payload for the Link API using the new item ID.
        const linkPayload: LinkPayload = {
          item: newItemId,
          url: url
        };

        // 3. Create the Link.
        return this.linkService.createLink(linkPayload);
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        // 4. Success: Navigate back home.
        this.toastService.showSuccess('Link added.');
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading = false;
        console.error('Submission failed:', err);
        this.toastService.showError('Failed to add item.');
        this.router.navigate(['/home']);
      }
    });
  }

  // Method for File Upload submission
  protected submitItemAndFiles(name: string, dateOfOrigin: string, fileDescription: string): void {
    // Extract URL from the form right before submission
    const url = this.addItemForm.get('url')?.value || '';
    const hasSecondaryLink = !!url;

    const itemPayload: ItemPayload = {
      name: name,
      type: 'file_group', // Item is always a file_group if files are selected
      date_of_origin: dateOfOrigin,
      tag_names: this.tags
    };

    this.itemService.createItem(itemPayload).pipe(
      // 1. Create the Item. API returns the new item object, including its ID.
      mergeMap((newItem: any) => {
        const newItemId = newItem.id;
        // 2. Upload Files using the new API.
        return this.itemService.uploadFilesToItem(newItemId, fileDescription, this.selectedFiles, this.selectedFileTypes).pipe(
          // 3. CONDITIONAL: Create Link if a URL was provided.
          // This nested mergeMap ensures the file upload is complete before trying to create the link.
          mergeMap(() => {
            if (hasSecondaryLink) {
              const linkPayload: LinkPayload = {
                item: newItemId,
                url: url
              };
              // Return the observable for Link creation
              return this.linkService.createLink(linkPayload);
            } else {
              // If no URL, return an Observable that immediately emits a null value, 
              // allowing the subscription to continue without error.
              return of(null);
            }
          })
        );
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        let successMsg = 'File uploaded.';
        if (hasSecondaryLink) {
          successMsg += ' A secondary link was also added.';
        }
        this.toastService.showSuccess(successMsg);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading = false;
        console.error('Submission failed:', err);
        this.toastService.showError('Failed to add item.');
        this.router.navigate(['/home']);
      }
    });
  }

  /**
   * Helper method to determine the array length of the currently active view mode
   */
  private getActiveLength(item: SafeItemInterface | SafeLinkPreview | UploadPreview): number {
    if (this.isEditing) {
      const editItem = item as SafeItemInterface;
      if (this.activeMediaMode === 'link' && editItem.safe_media_urls) {
        return editItem.safe_media_urls.length;
      }
      if (this.activeMediaMode === 'files' && editItem.safe_files) {
        return editItem.safe_files.length;
      }
    } else {
      const previewLink = item as SafeLinkPreview;
      const previewUpload = item as UploadPreview;
      if (this.activeMediaMode === 'link' && previewLink.safe_media) {
        return previewLink.safe_media?.length ?? 0;
      }
      if (this.activeMediaMode === 'files' && previewUpload.media) {
        return previewUpload.media?.length ?? 0;
      }
    }
    return 0;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * Navigate to the next media item
   * Stops at the final item.
   */
  public nextSlide(item: SafeItemInterface | SafeLinkPreview | UploadPreview): void {
    const idx = item.currentIndex ?? 0;
    const maxLen = this.getActiveLength(item);

    // Only increment if we are not at the last item
    if (idx < maxLen - 1) {
      item.currentIndex = idx + 1;
      this.cdr.markForCheck();
    }
  }

  /**
   * Navigate to the previous media item
   * Stops at the first item (0).
   */
  public prevSlide(item: SafeItemInterface | SafeLinkPreview | UploadPreview): void {
    const idx = item.currentIndex ?? 0;

    // Only decrement if we are not at the first item
    if (idx > 0) {
      item.currentIndex = idx - 1;
      this.cdr.markForCheck();
    }
  }

  public fetchUrlPreview(): void {
    const url = this.addItemForm.get('url')?.value?.trim();

    if (!this.isValidUrl(url)) {
      this.toastService.showError('Please enter a valid URL before fetching a preview.');
      return;
    }

    this.previewLoading = true;
    this.clearPreview();
    this.logger.log('[AddForm] Manually requesting media extract for:', url);

    this.linkService.extractMedia(url).subscribe({
      next: (response: SafeLinkPreview) => {
        this.previewLoading = false;
        if (response && response.safe_media && response.safe_media.length > 0) {
          this.previewItem = {
            ...response,
            currentIndex: 0
          };
          this.activeMediaMode = 'link';
          this.toastService.showSuccess('Preview loaded successfully.');
        } else {
          this.toastService.showError('No viewable media found on this link.');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.previewLoading = false;
        this.logger.error('[AddForm] Media extraction failed', err);
        this.toastService.showError('Failed to scrape media preview from this URL.');
        this.cdr.markForCheck();
      }
    });
  }

  private isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  }

  private clearPreview(): void {
    this.previewItem = { original_url: '', media: [], safe_media: [], currentIndex: 0 };
  }

}

