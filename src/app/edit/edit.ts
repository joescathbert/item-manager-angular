import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { mergeMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs'; // For the mergeMap error handling

// Re-use interfaces and services
import { ItemPayload, LinkPayload } from '../interfaces/item';
import { Item as ItemService } from '../services/item';
// 🚨 Import necessary interfaces for the item object 🚨
import { Item as ItemInterface, Tag, Link } from '../interfaces/item'; 
import { Add } from '../add/add';

@Component({
  selector: 'app-edit',
  standalone: true,
  // 🚨 Re-use Add's template and styles 🚨
  templateUrl: '../add/add.html', 
  styleUrl: '../add/add.scss',
  // Make sure to include all necessary imports for the template
  imports: [CommonModule, FormsModule, ReactiveFormsModule], 
  providers: [ItemService] 
})
// 🚨 Extend the Add class and implement OnInit 🚨
export class Edit extends Add implements OnInit { 

  // NEW: Variable to hold the original Item data being edited
  private editedItem!: ItemInterface; 

  // 🚨 OVERRIDE: Set custom values for the parent's protected properties 🚨
  // These will update the h2 and button text in add.html
  protected override isEditing: boolean = true;
  protected override headerText: string = 'Edit Item';
  protected override submitButtonText: string = 'Update Item';


  // Must re-inject everything the Add component uses, plus ActivatedRoute for ID
  constructor(
    protected override fb: FormBuilder, // 'override' is necessary when property is used in super()
    protected override itemService: ItemService,
    protected override router: Router,
    protected override route: ActivatedRoute
  ) {
    // Call the parent (Add) constructor with inherited services
    super(fb, itemService, router, route);
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

  // 🚨 NEW: Method to fetch and pre-fill the form 🚨
  private loadItemData(itemId: number): void {
    this.itemService.getItem(itemId).pipe(
      // 1. Get the Item.
      mergeMap((item: ItemInterface) => {
        this.editedItem = item;

        // 2. Check if it's a link and has a link_id
        if (item.type === 'link' && item.link_id) {
          // If yes, fetch the Link record, which contains the exact URL.
          return this.itemService.getLink(item.link_id).pipe(
             // Map the result to an object containing both the item and the link
            mergeMap((link: Link) => of({ item, link })) 
          );
        }

        // If no link, just return the item object.
        return of({ item, link: null }); 
      })
    ).subscribe({
      next: ({ item, link }) => {
        // 3. Pre-fill the form fields using the collected data
        this.addItemForm.patchValue({
          name: item.name,
          // Use the URL from the Link record if available, otherwise assume URL is on Item or empty
          url: link?.url || (item as any).url || '', 
          dateOfOrigin: item.date_of_origin 
        });

        // 4. Pre-fill and manage tags
        this.tags = item.tags.sort() || [];
        this.filterSuggestions(); 
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

  // 🚨 NEW: Update API method 🚨
  private updateItemAndLink(name: string, url: string, dateOfOrigin: string, tags: string[], originalItem: ItemInterface): void {
    const itemId = originalItem.id;
    const linkId = originalItem.link_id; 

    const itemPayload: ItemPayload = {
      name: name,
      type: 'link', 
      date_of_origin: dateOfOrigin,
      tag_names: tags
    };

    // 1. Update the Item record (tags, name, date)
    this.itemService.updateItem(itemId, itemPayload).pipe(
      // 2. If item update succeeds, update the Link record (required for URL changes)
      mergeMap(() => {
        if (linkId) {
          const linkPayload: LinkPayload = {
            item: itemId,
            url: url
          };
          // Call the service method to update the link
          return this.itemService.updateLink(linkId, linkPayload);
        }
        // If no link data exists, complete the observable chain
        return new Observable(observer => observer.complete());
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        alert('Success! Item updated.'); 
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading = false;
        console.error('Update failed:', err);
        alert('Error: Failed to update item. Check console for details.');
      }
    });
  }
}
