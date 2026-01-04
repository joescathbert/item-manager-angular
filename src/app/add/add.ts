import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule, AbstractControl, ValidatorFn } from '@angular/forms';
import { of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common'; // Needed for Common features like NgIf, NgFor
import { ItemPayload, LinkPayload } from '../interfaces/item';
import { Item as ItemService } from '../services/item';
import { Tag } from '../interfaces/item';

// We need to inject the NgIf/NgFor directives for standalone components
@Component({
  selector: 'app-add',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule], 
  templateUrl: './add.html',
  styleUrl: './add.scss'
})
export class Add {
  addItemForm!: FormGroup;
  tagInput: string = '';
  tags: string[] = [];
  loading: boolean = false; // For submission button state
  // State for suggestions
  allTags: Tag[] = [];
  suggestionTags: Tag[] = [];

  // 🚨 NEW: Property to hold the selected files
  selectedFiles: File[] = [];

  // Protected properties for the child (Edit) component to read/override 🚨
  protected isEditing: boolean = false;
  protected headerText: string = 'Add New Item';
  protected submitButtonText: string = 'Add Item';


  constructor(
    protected fb: FormBuilder,
    protected itemService: ItemService,
    protected router: Router,
    protected route: ActivatedRoute
  ) {}

  // 🚨 NEW: Custom Validator function to enforce URL OR File
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
      url: [''], // URL is now optional initially
    }, { validators: this.urlOrFileRequiredValidator });

    // Load all tags when the component initializes
    this.loadAllTags();

    this.handleTemplateTags();
  }

  // Helper to get today's date in YYYY-MM-DD format for the input default
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // --- Tag Management ---
  addTag() {
    const tagName = this.tagInput.trim();
    if (tagName && !this.tags.includes(tagName)) {
      this.tags.push(tagName);
      this.tagInput = ''; // Clear the input after adding
    }
  }

  removeTag(tagToRemove: string) {
    this.tags = this.tags.filter(tag => tag !== tagToRemove);
  }

  // --- Tag Suggestion Management ---
  loadAllTags(): void {
    this.itemService.getTags().subscribe({
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

    // Convert FileList to Array and merge with existing files (if any)
    const newFiles = Array.from(files);
    this.selectedFiles = [...this.selectedFiles, ...newFiles];

    // Reset the input value to allow the user to select the same file(s) again if needed
    event.target.value = null; 

    // If Item Name is default, set it to the first file's name
    if (this.selectedFiles.length > 0 && this.addItemForm.get('name')?.value === 'New Item') {
      this.addItemForm.patchValue({ name: this.selectedFiles[0].name });
    }
  }

  // 🚨 NEW: Removes a file from the selectedFiles array by index
  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    // If the last file was removed, you might want to adjust the form validity/name
    if (this.selectedFiles.length === 0) {
        this.addItemForm.patchValue({ name: 'New Item' });
    }
  }

  // 🚨 NEW: Moves a file up in the list (decreases index)
  moveFileUp(index: number): void {
    if (index > 0) {
      // Standard array swap using destructuring
      [this.selectedFiles[index - 1], this.selectedFiles[index]] = 
      [this.selectedFiles[index], this.selectedFiles[index - 1]];
    }
  }

  // 🚨 NEW: Moves a file down in the list (increases index)
  moveFileDown(index: number): void {
    if (index < this.selectedFiles.length - 1) {
      // Standard array swap using destructuring
      [this.selectedFiles[index + 1], this.selectedFiles[index]] = 
      [this.selectedFiles[index], this.selectedFiles[index + 1]];
    }
  }

  // 🚨 NEW: Getter to safely format the file names for display
  public get selectedFileNames(): string {
      if (this.selectedFiles && this.selectedFiles.length > 0) {
          return this.selectedFiles.map(f => f.name).join(', ');
      }
      return '';
  }

  // --- Form Actions ---
  onSubmit() {
    const { name, url, dateOfOrigin } = this.addItemForm.value;

    const hasUrl = !!url;
    const hasFiles = this.selectedFiles.length > 0;
    
    if (this.addItemForm.invalid || this.tags.length === 0 || (!hasUrl && !hasFiles)) {
      let errorMsg = '';
      if (this.addItemForm.invalid) errorMsg = 'Please fill out all required fields.';
      else if (this.tags.length === 0) errorMsg = 'Please add at least one tag.';
      // 🚨 CORE LOGIC: Ensure AT LEAST one of URL or Files is present.
      else if (!hasUrl && !hasFiles) errorMsg = 'Please provide a URL OR select at least one file.';

      alert(errorMsg);
      return;
    }

    this.loading = true;

    // 🚨 CONDITIONAL SUBMISSION LOGIC
    if (hasFiles) {
        // If files are present, use the NEW file group submission logic
        this.submitItemAndFiles(name, dateOfOrigin, this.tags, this.selectedFiles);
    } else {
        // If no files are present, use the OLD link submission logic
        this.submitItemAndLink(name, url, dateOfOrigin, this.tags);
    }
  }

  cancel() {
    this.router.navigate(['/home']);
  }

  // This method is now safe to be called by the default onSubmit()
  protected submitItemAndLink(name: string, url: string, dateOfOrigin: string, tags: string[]): void {
    const itemPayload: ItemPayload = {
      name: name,
      type: 'link', 
      date_of_origin: dateOfOrigin,
      tag_names: tags
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
        return this.itemService.createLink(linkPayload);
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        // 4. Success: Navigate back home.
        // TODO: Replace alert with a proper Angular Toast/Snackbar notification system
        alert('Success! Item and Link created.'); 
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading = false;
        console.error('Submission failed:', err);
        // TODO: Handle error and display user feedback
        alert('Error: Failed to add item. Check console for details.');
      }
    });
  }

  // 🚨 NEW: Method for File Upload submission
  protected submitItemAndFiles(name: string, dateOfOrigin: string, tags: string[], files: File[]): void {
    // Extract URL from the form right before submission
    const url = this.addItemForm.get('url')?.value || '';
    const hasSecondaryLink = !!url;

    const itemPayload: ItemPayload = {
      name: name,
      type: 'file_group', // Item is always a file_group if files are selected
      date_of_origin: dateOfOrigin,
      tag_names: tags
    };

    this.itemService.createItem(itemPayload).pipe(
      // 1. Create the Item. API returns the new item object, including its ID.
      mergeMap((newItem: any) => {
        const newItemId = newItem.id;

        // 2. Upload Files using the new API.
        return this.itemService.uploadFilesToItem(newItemId, files).pipe(
          // 3. CONDITIONAL: Create Link if a URL was provided.
          // This nested mergeMap ensures the file upload is complete before trying to create the link.
          mergeMap(() => {
            if (hasSecondaryLink) {
                const linkPayload: LinkPayload = {
                    item: newItemId,
                    url: url
                };
                // Return the observable for Link creation
                return this.itemService.createLink(linkPayload);
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
        let successMsg = 'Success! Item created and files uploaded.';
        if (hasSecondaryLink) {
            successMsg += ' A secondary link was also added.';
        }
        alert(successMsg); 
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading = false;
        console.error('Submission failed:', err);
        alert('Error: Failed to add item or upload files/link. Check console for details.');
      }
    });
  }

}

