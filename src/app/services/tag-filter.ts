import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TagFilter {
  // Use BehaviorSubject to hold the current state and emit updates
  // Initializes with an empty array of filters
  private _activeFilters$ = new BehaviorSubject<string[]>([]);

  // Public Observable for components to subscribe to filter changes
  public readonly activeFilters$: Observable<string[]> = this._activeFilters$.asObservable();

  // Public getter to access the current value synchronously
  public get currentFilters(): string[] {
    return this._activeFilters$.value;
  }

  constructor() { }

  /**
   * Adds a tag to the active filters if it's not already present.
   */
  addFilter(tag: string): void {
    const current = this._activeFilters$.value;
    if (!current.includes(tag)) {
      const updated = [...current, tag];
      this._activeFilters$.next(updated);
    }
  }

  /**
   * Removes a tag from the active filters.
   */
  removeFilter(tag: string): void {
    const current = this._activeFilters$.value;
    const updated = current.filter(t => t !== tag);
    this._activeFilters$.next(updated);
  }

  /**
   * Clears all active filters.
   */
  clearFilters(): void {
    if (this._activeFilters$.value.length > 0) {
      this._activeFilters$.next([]);
    }
  }
}
