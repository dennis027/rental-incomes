import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/api/login/';
  private logoutUrl = 'http://127.0.0.1:8000/api/logout/';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  login(payload: { identifier: string; password: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload).pipe(
      tap(res => {
        if (isPlatformBrowser(this.platformId) && res.success && res.data?.access) {
          localStorage.setItem('access_token', res.data.access);
          localStorage.setItem('refresh_token', res.data.refresh);
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


  let headers = new HttpHeaders();
  if (accessToken) {
    headers = headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // 🟡 Django expects the refresh token in the body
  const body = { refresh: refreshToken };

  return this.http.post<any>(this.logoutUrl, body, { headers }).pipe(
    tap({
      next: () => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      },
      error: () => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
    })
  );
}

}