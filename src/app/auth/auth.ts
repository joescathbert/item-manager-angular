import { Injectable, Inject} from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private baseUrl = 'http://192.168.0.109:8000/api/users';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  login(username: string, password: string): Observable<any> {
    const token = 'Basic ' + btoa(`${username}:${password}`);
    const headers = new HttpHeaders({ Authorization: token });

    return this.http.get(`${this.baseUrl}/by-username?username=${username}`, { headers });
  }

  saveToken(username: string, password: string) {
    if (isPlatformBrowser(this.platformId)) {
      console.log('Saving token on platform ID:', this.platformId);
      const token = 'Basic ' + btoa(`${username}:${password}`);
      localStorage.setItem('auth_token', token);
    } else {
      console.log('Skipping token save on server.');
    }
  }

  getToken(): string | null {
    console.log('Retrieving token on platform ID:', this.platformId);
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
    }
  }
}