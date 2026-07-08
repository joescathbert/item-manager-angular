import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PreviewLink, SafePreviewLink, Link as LinkInterface, LinkPayload } from '../interfaces/link';
import { Logger } from './logger';
import { environment } from '../../environments/environment';
import { DomSanitizer } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class Link {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private logger: Logger,
    private sanitizer: DomSanitizer
  ) { }

  /**
   * POST /links/extract-media/
   * Scrapes external stream links from a URL, routes specific video domains 
   * through a proxy, and passes them through DomSanitizer in-pipeline.
   */
  extractMedia(url: string): Observable<SafePreviewLink> {
    const targetUrl = `${this.baseUrl}/links/extract-media/`;
    this.logger.log('[LinkService] Processing extraction stream target for:', url);

    return this.http.post<PreviewLink>(targetUrl, { url }).pipe(
      map((response: PreviewLink): SafePreviewLink => {
        const proxyDomains = ['media.redgifs.com', 'video.twimg.com', 'i.imgur.com'];

        const safeMedia = response.media?.map(m => {
          let hdUrl = m.hd_url;
          let sdUrl = m.sd_url;

          // Apply Proxy Logic for specific video domains based on string matching
          if (m.media_type === 'video') {
            if (hdUrl && proxyDomains.some(domain => hdUrl.includes(domain))) {
              hdUrl = `${this.baseUrl}/proxy-media/?url=${encodeURIComponent(hdUrl)}`;
            }
            if (sdUrl && proxyDomains.some(domain => sdUrl.includes(domain))) {
              sdUrl = `${this.baseUrl}/proxy-media/?url=${encodeURIComponent(sdUrl)}`;
            }
          }

          return {
            ...m,
            safe_hd_url: hdUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(hdUrl) : undefined,
            safe_sd_url: sdUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(sdUrl) : undefined
          };
        }) || [];

        return {
          ...response,
          currentIndex: 0,
          safe_media: safeMedia
        };
      }),
      catchError(error => {
        this.logger.error('[LinkService] Media extraction sequence hit an execution error', error);
        return throwError(() => error);
      })
    );
  }

  // unused
  getLink(linkId: number): Observable<LinkInterface> {
    const url = `${this.baseUrl}/links/${linkId}/`;
    this.logger.log('Fetching link from URL:', url);
    return this.http.get<LinkInterface>(url);
  }

  createLink(payload: LinkPayload): Observable<any> {
    const url = `${this.baseUrl}/links/`;
    this.logger.log('Creating link at URL:', url, 'with payload:', payload);
    return this.http.post(url, payload);
  }

  updateLink(linkId: number, payload: LinkPayload): Observable<any> {
    const url = `${this.baseUrl}/links/${linkId}/`;
    this.logger.log('Updating link at URL:', url, 'with payload:', payload);
    return this.http.put(url, payload);
  }

  deleteLink(linkId: number): Observable<any> {
    const url = `${this.baseUrl}/links/${linkId}/`;
    this.logger.log('Deleting link at URL:', url);
    return this.http.delete(url);
  }
}
