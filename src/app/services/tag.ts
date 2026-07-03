import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Tag as TagInterface, TagCategoryValue } from '../interfaces/tag';
import { Logger } from './logger';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Tag {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private logger: Logger
  ) { }

  /**
   * Fetches all available tags
   */
  getTags(): Observable<TagInterface[]> {
    const url = `${this.baseUrl}/tags/`;
    this.logger.log('[TagService] Fetching all tags from:', url);
    return this.http.get<TagInterface[]>(url).pipe(
      catchError(error => {
        this.logger.error('[TagService] Failed to fetch tags', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * GET /tags/categories/
   * Extracts and returns a unique list of categories from tags formatted as <category>-<name>.
   */
  getTagCategories(): Observable<string[]> {
    const url = `${this.baseUrl}/tags/categories/`;
    this.logger.log('[TagService] Fetching tag categories from:', url);
    return this.http.get<string[]>(url).pipe(
      tap(categories => this.logger.log(`[TagService] Received ${categories.length} categories`)),
      catchError(error => {
        this.logger.error('[TagService] Failed to fetch tag categories', error);
        return throwError(() => error);
      })
    );
  }

  /**
 * GET /tags/category-values/
 * Extracts a unique list of values, item counts, and full names for a given category.
 * @param category The category name to look up (Required)
 * @param tagFilters Optional array of tag names to filter before counting
 */
  getTagCategoryValues(category: string, tagFilters: string[] = []): Observable<TagCategoryValue[]> {
    const url = `${this.baseUrl}/tags/category-values/`;

    // Build query parameters
    let params = new HttpParams().set('category', category);
    if (tagFilters && tagFilters.length > 0) {
      params = params.set('tag_names', tagFilters.join(','));
    }

    this.logger.log(`[TagService] Fetching category values for "${category}" with filters:`, tagFilters);

    return this.http.get<TagCategoryValue[]>(url, { params }).pipe(
      catchError(error => {
        this.logger.error(`[TagService] Failed to fetch category values for ${category}`, error);
        return throwError(() => error);
      })
    );
  }
}