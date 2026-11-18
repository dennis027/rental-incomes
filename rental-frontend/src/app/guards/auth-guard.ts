import { inject } from '@angular/core';
import { rememberPath } from '../services/return-path';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { currentRole, homeFor, roleCanOpen } from '../services/account';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // ✅ Always allow navigation on the server
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // ✅ Check the session only in the browser. An expired access token is
  // fine while the refresh token is live: the session interceptor renews it.
  if (authService.hasSession()) {
    // Pages outside the user's role send them to their own start page
    const role = currentRole();
    return roleCanOpen(role, state.url) ? true : router.createUrlTree([homeFor(role)]);
  }

  // Signed out or expired: drop the stale tokens so the login page shows its
  // form, and remember the page that was asked for
  if (authService.getAccessToken()) {
    authService.clearSession();
    sessionStorage.setItem('session_expired', '1');
  }
  rememberPath(state.url);
  return router.createUrlTree(['/login']);
};