import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private maintenanceURL = `${environment.apiUrl}api/maintenance-requests/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** 🔹 Get All Maintenance Requests */
  getMaintenanceRequests(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(this.maintenanceURL, { headers });
  }

  /** 🔹 Add New Maintenance Request (POST /api/maintenance-requests/) */
  addMaintenanceRequest(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(this.maintenanceURL, data, { headers });
  }

  /** 🔹 Update Maintenance Request (PUT /api/maintenance-requests/:id/) */
  updateMaintenanceRequest(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.put<any>(`${this.maintenanceURL}${id}/`, data, { headers });
  }

  /** 🔹 Delete Maintenance Request (DELETE /api/maintenance-requests/:id/) */
  deleteMaintenanceRequest(id: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete<any>(`${this.maintenanceURL}${id}/`, { headers });
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
