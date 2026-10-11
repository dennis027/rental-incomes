import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  private unitsURL = `${environment.apiUrl}api/units/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** 🔹 Get All Units or a Specific Unit */
  getUnits(id?: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = id ? `${this.unitsURL}${id}/` : this.unitsURL;
    return this.http.get<any>(url, { headers });
  }

  /** 🔹 Add New Unit */
  addUnit(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(this.unitsURL, data, { headers });
  }

  /** 🔹 Update Existing Unit */
  updateUnit(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.put<any>(`${this.unitsURL}${id}/`, data, { headers });
  }

  /** 🔹 Delete Unit */
  deleteUnit(id: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete<any>(`${this.unitsURL}${id}/`, { headers });
  }

  /** 🔹 Helper: Construct Headers with Bearer Token */
  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    const accessToken = this.getAccessToken();
    if (accessToken) {
      headers = headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return headers;
  }

  /** 🔹 Helper: Safely Retrieve Token from LocalStorage (Browser Only) */
  private getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token');
    }
    return null;
  }
}
