import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
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
  // 👈 NEW: State for suggestions
  allTags: Tag[] = [];
  suggestionTags: Tag[] = [];

  // 🚨 NEW: Protected properties for the child (Edit) component to read/override 🚨
  protected isEditing: boolean = false;
  protected headerText: string = 'Add New Item';
  protected submitButtonText: string = 'Add Item';


  constructor(
    protected fb: FormBuilder,
    protected itemService: ItemService,
    protected router: Router,
    protected route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.addItemForm = this.fb.group({
      name: ['New Item', Validators.required],
      url: ['', Validators.required], 
      dateOfOrigin: [this.getCurrentDate(), Validators.required], 
    });

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

  // Handles pre filling tags from query parameters
  private handleTemplateTags(): void {
    // We subscribe to queryParams to capture tags passed from the Home component
    this.route.queryParams.subscribe(params => {
      const templateTagsString = params['templateTags'];

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

  // --- Form Actions ---
  onSubmit() {
    if (this.addItemForm.invalid || this.tags.length === 0) {
      alert(this.addItemForm.invalid ? 'Please fill out all required fields.' : 'Please add at least one tag.');
        return;
    }

    this.loading = true;
    const { name, url, dateOfOrigin } = this.addItemForm.value;

    // Call the combined submission logic (defined below)
    this.submitItemAndLink(name, url, dateOfOrigin, this.tags);
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
}
