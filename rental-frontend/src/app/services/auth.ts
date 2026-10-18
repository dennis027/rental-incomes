import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl+'api/login/';
  private logoutUrl = environment.apiUrl+'api/logout/';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  login(payload: { identifier: string; password: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload).pipe(
      tap(res => {
        if (isPlatformBrowser(this.platformId) && res.success && res.data?.access) {
          localStorage.setItem('access_token', res.data.access);
          localStorage.setItem('refresh_token', res.data.refresh);
          // Shown in the top bar's account menu
          localStorage.setItem('user_name', res.data.user?.username ?? '');
          localStorage.setItem('user_email', res.data.user?.email ?? '');
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

logout(): Observable<any> {
  const accessToken = this.getAccessToken();
  const refreshToken = isPlatformBrowser(this.platformId)
    ? localStorage.getItem('refresh_token')
    : null;

  // The session ends locally straight away, whatever the server answers
  if (isPlatformBrowser(this.platformId)) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
  }

  // Nothing to revoke on the server
  if (!accessToken || !refreshToken) {
    return of(null);
  }

  // Django expects the refresh token in the body
  const headers = new HttpHeaders().set('Authorization', `Bearer ${accessToken}`);
  return this.http.post<any>(this.logoutUrl, { refresh: refreshToken }, { headers });
}

}
