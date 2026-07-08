import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Item as ItemInterface, PagedItems, ItemNeighbors, FileGroup, PaginatedFeedResponse } from '../interfaces/item';
import { ItemPayload } from '../interfaces/item';
import { Logger } from './logger';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Item {
  private baseUrl = environment.apiUrl;

  private nextUrlSubject = new Subject<string | null>();
  public nextUrl$ = this.nextUrlSubject.asObservable();

  private nextUrl: string | null = null;

  // Separate state tracker dedicated solely to the feed view to prevent collision with getItems()
  private feedNextUrl: string | null = null;

  constructor(
    private http: HttpClient,
    private logger: Logger
  ) { }

  getItems(page: number, tags: string[] = []): Observable<PagedItems> {
    let url: string;
    let options = {};

    if (this.nextUrl) {
      url = this.nextUrl;
    } else {
      url = `${this.baseUrl}/items/`;

      let params = new HttpParams().set('page', page.toString());

      if (tags && tags.length > 0) {
        params = params.set('tag_names', tags.join(','));
      }

      options = { params };
    }

    this.logger.log(`Fetching items from URL: ${url}`);

    return this.http.get<PagedItems>(url, options).pipe(
      map(response => {
        // Update the pagination state
        this.nextUrl = response.next;
        this.nextUrlSubject.next(response.next);
        return response;
      })
    );
  }

  resetPagination() {
    this.nextUrl = null;
    this.logger.log('ItemService: Pagination state reset.');
  }

  getItem(itemId: number, tags?: string[]): Observable<ItemInterface> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    let options = {};
    let params = new HttpParams();
    if (tags && tags.length > 0) {
      params = params.set('tag_names', tags.join(','));
    }
    options = { params };
    const fullUrl = params.keys().length > 0
      ? `${url}?${params.toString()}`
      : url;
    this.logger.log('Fetching item from URL:', fullUrl);
    return this.http.get<ItemInterface>(url, options).pipe(
      tap(item => this.logger.log(`[ItemService] Received item: ${item.name}`, item)),

      catchError(error => {
        this.logger.error(`[ItemService] Failed to fetch item ${itemId}`, error);
        return throwError(() => error);
      })
    );
  }

  getItemNeighbors(itemId: number, tagFilters: string[]): Observable<ItemNeighbors> {
    let url: string;
    let params: string[] = [];
    if (tagFilters && tagFilters.length > 0) {
      // Join tags with a comma, as per API
      params.push(`tag_names=${tagFilters.join(',')}`);
    }
    console.log('ItemService: Fetching item neighbors with tag filters:', tagFilters);
    url = `${this.baseUrl}/items/${itemId}/neighbors/?${params.join('&')}`;
    this.logger.log('Fetching item neighbors from URL:', url);
    return this.http.get<ItemNeighbors>(url);
  }

  // Unused
  getFileGroup(fileGroupId: number): Observable<FileGroup> {
    const url = `${this.baseUrl}/file-groups/${fileGroupId}/`;
    this.logger.log('Fetching file group from URL:', url);
    return this.http.get<FileGroup>(url);
  }

  createItem(payload: ItemPayload): Observable<any> {
    const url = `${this.baseUrl}/items/`;
    this.logger.log('Creating item at URL:', url, 'with payload:', payload);
    return this.http.post(url, payload);
  }

  updateItem(itemId: number, payload: ItemPayload): Observable<any> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    this.logger.log('Updating item at URL:', url, 'with payload:', payload);
    return this.http.put(url, payload);
  }

  deleteItem(itemId: number): Observable<any> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    this.logger.log('Deleting item at URL:', url);
    return this.http.delete(url);
  }

  uploadFilesToItem(itemId: number, files: File[], fileTypes: string[]): Observable<any> {
    // 1. Define the target URL for your Django endpoint
    const url = `${this.baseUrl}/file-groups/upload-to-gdrive/`;

    // 2. Create the FormData object to hold binary and text data
    const formData: FormData = new FormData();

    // 3. Append the Item ID (as specified in your curl example)
    formData.append('item', itemId.toString());

    // 4. Append all selected files using the key 'files' (as specified in your curl example)
    files.forEach((file, index) => {
      // The third argument is the filename, which helps the backend process the file
      formData.append('files', file, file.name);
      if (fileTypes && fileTypes[index]) {
        formData.append('file_types', fileTypes[index]);
      }
    });

    this.logger.log('Uploading files to URL:', url, 'for Item ID:', itemId);

    // 5. Perform the POST request
    // The Angular HttpClient handles the 'Content-Type: multipart/form-data' header automatically 
    // when sending a FormData object, which is correct.
    return this.http.post(url, formData);
  }

  /**
   * Requests the backend to zip all files matching the given item_id
   * and returns the archive file as a binary Blob.
   */
  downloadItemZip(itemId: number): Observable<Blob> {
    const url = `${this.baseUrl}/items/download-zip/`;
    const params = new HttpParams().set('item_id', itemId.toString());

    this.logger.log(`Downloading file zip archive for Item ID: ${itemId}`);

    return this.http.get(url, {
      params: params,
      responseType: 'blob' // Essential for dealing with file downloads
    });
  }

  /**
   * Helper utility to process and append backend media proxy URLs if the asset 
   * domain matches standard external platforms requiring CORS/Referer bypass.
   */
  private processFeedAssetUrls(url: string): string {
    const proxyDomains = ['media.redgifs.com', 'video.twimg.com', 'i.imgur.com'];

    try {
      const assetUrl = new URL(url);
      // Check if the domain matches our targeted list
      if (proxyDomains.includes(assetUrl.hostname)) {
        return `${this.baseUrl}/proxy-media/?url=${encodeURIComponent(url)}`;
      }
    } catch (e) {
      // Fall back safely to the raw url string if it's a relative local API route (e.g., /api/files/799/serve/)
      return url;
    }

    return url;
  }

  /**
   * Fetches the paginated item shorts feed and automatically wraps asset 
   * endpoints with the proxy URL if they point to third-party domains.
   */
  getItemFeed(targetUrl?: string | null): Observable<any> {
    const url = targetUrl || this.feedNextUrl || `${this.baseUrl}/items/feed/`;

    this.logger.log(`[ItemService] Fetching feed from URL: ${url}`);

    return this.http.get<any>(url).pipe(
      map(response => {
        // Intercept and loop through the results to append proxy strings safely
        const processedResults = response.results.map((item: any) => {
          if (item.mediaList && item.mediaList.length > 0) {
            item.mediaList = item.mediaList.map((media: any) => ({
              ...media,
              // Run the source URL through the proxy checker rule base
              url: this.processFeedAssetUrls(media.url)
            }));
          }
          return item;
        });

        // Return modified response object structure intact
        return {
          ...response,
          results: processedResults
        };
      }),
      tap(response => {
        // Cache the next pagination cursor internally
        this.feedNextUrl = response.next;
      }),
      catchError(error => {
        this.logger.error('[ItemService] Failed to fetch item shorts feed', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Explicitly resets the feed pagination whenever you need to refresh from scratch.
   */
  resetFeedPagination(): void {
    this.feedNextUrl = null;
    this.logger.log('[ItemService] Feed pagination state reset.');
  }
}
