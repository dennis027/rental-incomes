import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SystemParametersServices {
  
  private systemParamsURL = `${environment.apiUrl}api/properties/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

    /** 🔹 Get All Receipts or a Specific Receipt */
    getSystemParams(id?: string | number): Observable<any> {
      const headers = this.getAuthHeaders();
      const url = this.systemParamsURL+id+'/system-parameters/';
      return this.http.get<any>(url, { headers });
    }

    updateSystemParams(id: string | number, data: any): Observable<any> {
      const headers = this.getAuthHeaders();
      return this.http.patch<any>(`${this.systemParamsURL}${id}/system-parameters/`, data, { headers });
    }
  

  /** 🔹 Helper: Get Auth Headers with Bearer Token */
  private getAuthHeaders(): HttpHeaders {
    const accessToken = this.getAccessToken();
    let headers = new HttpHeaders();

    if (accessToken) {
      headers = headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return headers;
  }

  /** 🔹 Helper: Retrieve Token from LocalStorage */
  private getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token');
    }
    return null;
  }
}
