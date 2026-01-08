import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
  isHiding?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class Toast { 
  private counter = 0;
  private readonly MAX_TOASTS = 3;
  private readonly DURATION = 4000;
  private readonly EXIT_DURATION = 500;

  // Holds the current array state and emits whenever it changes
  public toasts$: BehaviorSubject<ToastMessage[]> = new BehaviorSubject<ToastMessage[]>([]);

  constructor() {}

  /** Removes a specific toast by its ID. */
  private removeToast(id: number): void {
    const currentToasts = this.toasts$.getValue();
    const toastToHide = currentToasts.find(t => t.id === id);

    if (toastToHide) {
      // PHASE 1: Trigger Exit Animation (Immediate)
      toastToHide.isHiding = true;
      this.toasts$.next([...currentToasts]); // Emit to trigger the [class.is-hiding] CSS

      // PHASE 2: Physical Removal (After Animation Completes)
      setTimeout(() => {
        const newToasts = this.toasts$.getValue().filter(t => t.id !== id);
        this.toasts$.next(newToasts); // Emit the final array change
      }, this.EXIT_DURATION); 
    }
  }

  // --- Public API for components to call ---

  show(message: string, type: 'success' | 'error' | 'info'): void {
    const newToast: ToastMessage = { 
      message, 
      type, 
      id: this.counter++ 
    };

    let currentToasts = this.toasts$.getValue();

    // 1. Add the new toast
    currentToasts = [...currentToasts, newToast];

    // 2. Limit the number of visible toasts (removes oldest if limit exceeded)
    if (currentToasts.length > this.MAX_TOASTS) {
        currentToasts.shift(); 
    }

    // 3. Emit the new array state (this is what triggers the async pipe in the template)
    this.toasts$.next(currentToasts); 

    // 4. Set a dedicated timer to remove this specific toast after 4 seconds
    setTimeout(() => {
      this.removeToast(newToast.id);
    }, this.DURATION);
  }

  showSuccess(message: string): void {
    this.show(message, 'success');
  }

  showError(message: string): void {
    this.show(message, 'error');
  }

  showInfo(message: string): void {
    this.show(message, 'info');
  }
}
