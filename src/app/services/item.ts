import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Item as ItemInterface, Link, PagedItems, Tag } from '../interfaces/item';
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

  getItems(page: number): Observable<ItemInterface[]> {
    const url = this.nextUrl || `${this.baseUrl}/items/?page=${page}`;
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

  deleteItem(itemId: number): Observable<any> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    this.logger.log('Deleting item at URL:', url);
    return this.http.delete(url);
  }
}
