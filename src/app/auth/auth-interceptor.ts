import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core'; // <-- Import PLATFORM_ID
import { isPlatformBrowser } from '@angular/common'; // <-- Import isPlatformBrowser
import { Auth as AuthService } from './auth';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {

  const authService = inject(AuthService); 
  // 1. Get the current platform ID
  const platformId = inject(PLATFORM_ID); 

  // 2. Do NOT try to get the token or attach headers if running on the server
  if (!isPlatformBrowser(platformId)) {
    // If on the server, let the request proceed without the token.
    // The successful load will happen later during client-side execution.
    return next(req); 
  }

  // --- Client-side logic proceeds here ---
  const authToken = authService.getToken();

  if (authToken) {
    const authRequest = req.clone({
      setHeaders: {
        Authorization: authToken 
      }
    });
    return next(authRequest);
  }

  // If on the browser but no token is found, pass original request
  return next(req);
};