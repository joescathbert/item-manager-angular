import { inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth as AuthService } from './auth';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    const token = auth.getToken();
    if (token) return true;
    router.navigate(['/login']);
    return false;
  }

  // On server, allow navigation so SSR doesn’t kick you out
  return true;
};
