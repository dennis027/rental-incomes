import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { rememberPath } from './return-path';
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl+'api/login/';
  private logoutUrl = environment.apiUrl+'api/logout/';

  constructor(private http: HttpClient, private router: Router, @Inject(PLATFORM_ID) private platformId: Object) {}

  login(payload: { identifier: string; password: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload).pipe(
      tap(res => {
        if (isPlatformBrowser(this.platformId) && res.success && res.data?.access) {
          localStorage.setItem('access_token', res.data.access);
          localStorage.setItem('refresh_token', res.data.refresh);
          // Shown in the top bar's account menu
          localStorage.setItem('user_name', res.data.user?.username ?? '');
          localStorage.setItem('user_email', res.data.user?.email ?? '');
          // Decides which pages the dashboard shows; the API enforces it as well
          localStorage.setItem('user_role', res.data.user?.role ?? 'owner');
          localStorage.setItem('account_name', res.data.user?.account ?? '');
          localStorage.setItem('user_full_name', res.data.user?.full_name ?? '');
        }
      })
    );
  }

  getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  /**
   * True while the user can still make API calls: either the access token is
   * live, or it has expired but the refresh token can still renew it.
   */
  hasSession(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return !isExpired(localStorage.getItem('access_token'))
      || !isExpired(localStorage.getItem('refresh_token'));
  }

  /** Forgets the stored tokens without calling the server */
  clearSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_role');
      localStorage.removeItem('account_name');
      localStorage.removeItem('user_full_name');
    }
  }

  /**
   * Ends a session that can no longer be renewed: forgets the tokens, tells
   * the login page why the user is back there and sends them to it. Signing
   * in again brings them back to the page they were on.
   */
  expireSession(): void {
    this.clearSession();
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    sessionStorage.setItem('session_expired', '1');
    if (!this.router.url.startsWith('/login')) {
      rememberPath(this.router.url);
      this.router.navigate(['/login']);
    }
  }

logout(): Observable<any> {
  const accessToken = this.getAccessToken();
  const refreshToken = isPlatformBrowser(this.platformId)
    ? localStorage.getItem('refresh_token')
    : null;

  // The session ends locally straight away, whatever the server answers
  this.clearSession();

  // Nothing to revoke on the server
  if (!accessToken || !refreshToken) {
    return of(null);
  }

  // Django expects the refresh token in the body
  const headers = new HttpHeaders().set('Authorization', `Bearer ${accessToken}`);
  return this.http.post<any>(this.logoutUrl, { refresh: refreshToken }, { headers });
}

}

/**
 * Whether a JWT is missing, unreadable or past its expiry. The signature is
 * not checked here; the API does that. A few seconds of slack covers clock
 * drift and the time the request takes to arrive.
 */
export function isExpired(token: string | null): boolean {
  if (!token) {
    return true;
  }
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp !== 'number' || exp * 1000 <= Date.now() + 10_000;
  } catch {
    return true;
  }
}
