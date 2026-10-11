import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

const refreshUrl = `${environment.apiUrl}api/token/refresh/`;

// Requests that must never trigger a token refresh
const publicCalls = /api\/(login|logout|register|token\/refresh|reset-password|password-reset|activate|resend-activation-limited)\//;

// Shared so that several requests failing at once only refresh the token once
let refreshInFlight: Observable<string> | null = null;

/**
 * Adds the access token to every request. When the token has expired it is
 * renewed with the refresh token and the request is retried; if that is not
 * possible the user is sent back to the login page.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // localStorage only exists in the browser
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const router = inject(Router);
  const http = new HttpClient(inject(HttpBackend));
  const withToken = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  const endSession = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // The login page reads this to explain why the user is back there
    sessionStorage.setItem('session_expired', '1');
    if (!router.url.startsWith('/login')) {
      router.navigate(['/login']);
    }
  };

  return next(withToken(localStorage.getItem('access_token'))).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || publicCalls.test(req.url)) {
        return throwError(() => error);
      }

      const refresh = localStorage.getItem('refresh_token');
      if (!refresh) {
        endSession();
        return throwError(() => error);
      }

      if (!refreshInFlight) {
        refreshInFlight = http.post<{ access: string; refresh?: string }>(refreshUrl, { refresh }).pipe(
          tap(res => {
            localStorage.setItem('access_token', res.access);
            if (res.refresh) {
              localStorage.setItem('refresh_token', res.refresh);
            }
          }),
          map(res => res.access),
          finalize(() => (refreshInFlight = null)),
          shareReplay(1)
        );
      }

      return refreshInFlight.pipe(
        catchError(() => {
          endSession();
          return throwError(() => error);
        }),
        switchMap(access => next(withToken(access)))
      );
    })
  );
};
