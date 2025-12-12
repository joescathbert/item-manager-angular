import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Item, Link } from '../interfaces/item';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private baseUrl = 'http://192.168.0.109:8000/api';

  constructor(private http: HttpClient) {}

  getItems(page: number): Observable<Item[]> {
    // assuming your API supports pagination with ?page=
    return this.http.get<Item[]>(`${this.baseUrl}/items/?page=${page}`);
  }

  getLink(linkId: number): Observable<Link> {
    return this.http.get<Link>(`${this.baseUrl}/links/${linkId}/`);
  }

  deleteItem(itemId: number): Observable<any> {
    const url = `${this.baseUrl}/items/${itemId}/`;
    return this.http.delete(url);
  }
}
