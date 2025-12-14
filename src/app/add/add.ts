// 📝 add.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { mergeMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common'; // Needed for Common features like NgIf, NgFor
import { ItemPayload, LinkPayload } from '../interfaces/item';
import { Item as ItemService } from '../services/item';

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

  constructor(
    private fb: FormBuilder,
    private itemService: ItemService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.addItemForm = this.fb.group({
      // We'll use a placeholder name for now.
      name: ['New Item', Validators.required], 
      url: ['', Validators.required], 
      // Validators.required for date is strong, adjust if needed
      dateOfOrigin: [this.getCurrentDate(), Validators.required], 
    });
  }
  
  // Helper to get today's date in YYYY-MM-DD format for the input default
  getCurrentDate(): string {
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

  // --- Form Actions ---
  cancel() {
    this.router.navigate(['/home']);
  }

  onSubmit() {
    if (this.addItemForm.invalid) {
      alert('Please fill out all required fields.');
      return;
    }
    
    if (this.tags.length === 0) {
        alert('Please add at least one tag.');
        return;
    }

    this.loading = true;
    const { name, url, dateOfOrigin } = this.addItemForm.value;

    // Call the combined submission logic (defined below)
    this.submitItemAndLink(name, url, dateOfOrigin, this.tags);
  }

  submitItemAndLink(name: string, url: string, dateOfOrigin: string, tags: string[]): void {
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
