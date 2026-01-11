import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Item as ItemInterface, Link, PagedItems, Tag, ItemNeighbors } from '../interfaces/item';
import { ItemPayload, LinkPayload } from '../interfaces/item';
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

  constructor(
    private http: HttpClient,
    private logger: Logger
  ) {}

  getItems(page: number, tags: string[] = []): Observable<ItemInterface[]> {
    let url: string;

    if (this.nextUrl) {
      url = this.nextUrl;
    } else {
      let params = [`page=${page}`];
      if (tags && tags.length > 0) {
        // Join tags with a comma, as per API
        params.push(`tag_names=${tags.join(',')}`); 
      }
      url = `${this.baseUrl}/items/?${params.join('&')}`;
    }

    this.logger.log(`Fetching items from URL: ${url}`);

    return this.http.get<PagedItems>(url).pipe(
      map(response => {
        this.nextUrl = response.next;
        this.nextUrlSubject.next(response.next);
        return response.results;
      })
    );
  }

  resetPagination() {
    this.nextUrl = null;
    this.logger.log('ItemService: Pagination state reset.');
  }

  getItem(itemId: number): Observable<ItemInterface> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    this.logger.log('Fetching item from URL:', url);
    return this.http.get<ItemInterface>(url);
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

  getLink(linkId: number): Observable<Link> {
    const url = `${this.baseUrl}/links/${linkId}/`;
    this.logger.log('Fetching link from URL:', url);
    return this.http.get<Link>(url);
  }

  getTags(): Observable<Tag[]> {
    const url = `${this.baseUrl}/tags/`
    this.logger.log('Fetching tags from URL:', url);
    return this.http.get<Tag[]>(url);
  }

  createItem(payload: ItemPayload): Observable<any> {
    const url = `${this.baseUrl}/items/`;
    this.logger.log('Creating item at URL:', url, 'with payload:', payload);
    return this.http.post(url, payload);
  }

  createLink(payload: LinkPayload): Observable<any> {
    const url = `${this.baseUrl}/links/`;
    this.logger.log('Creating link at URL:', url, 'with payload:', payload);
    return this.http.post(url, payload);
  }

  updateItem(itemId: number, payload: ItemPayload): Observable<any> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    this.logger.log('Updating item at URL:', url, 'with payload:', payload);
    return this.http.put(url, payload);
  }

  updateLink(linkId: number, payload: LinkPayload): Observable<any> {
    const url = `${this.baseUrl}/links/${linkId}/`;
    this.logger.log('Updating link at URL:', url, 'with payload:', payload);
    return this.http.put(url, payload);
  }

  deleteItem(itemId: number): Observable<any> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    this.logger.log('Deleting item at URL:', url);
    return this.http.delete(url);
  }

  deleteLink(linkId: number): Observable<any> {
    const url = `${this.baseUrl}/links/${linkId}/`;
    this.logger.log('Deleting link at URL:', url);
    return this.http.delete(url);
  }

  uploadFilesToItem(itemId: number, files: File[]): Observable<any> {
    // 1. Define the target URL for your Django endpoint
    const url = `${this.baseUrl}/file-groups/upload-multiple/`;

    // 2. Create the FormData object to hold binary and text data
    const formData: FormData = new FormData();

    // 3. Append the Item ID (as specified in your curl example)
    formData.append('item', itemId.toString());

    // 4. Append all selected files using the key 'files' (as specified in your curl example)
    files.forEach((file) => {
      // The third argument is the filename, which helps the backend process the file
      formData.append('files', file, file.name); 
    });

    this.logger.log('Uploading files to URL:', url, 'for Item ID:', itemId);

    // 5. Perform the POST request
    // The Angular HttpClient handles the 'Content-Type: multipart/form-data' header automatically 
    // when sending a FormData object, which is correct.
    return this.http.post(url, formData);
  }
}
