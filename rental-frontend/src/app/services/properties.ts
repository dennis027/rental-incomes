import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PropertiesService {
  private propertiesURL = `${environment.apiUrl}api/properties/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** 🔹 Get All Properties */
  getProperties(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(this.propertiesURL, { headers });
  }

  /** 🔹 Add New Property (POST /api/properties/) */
  addProperty(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(this.propertiesURL, data, { headers });
  }

  /** 🔹 Update Property (PUT /api/properties/:id/) */
  updateProperty(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.put<any>(`${this.propertiesURL}${id}/`, data, { headers });
  }

  /** 🔹 Delete Property (DELETE /api/properties/:id/) */
  deleteProperty(id: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete<any>(`${this.propertiesURL}${id}/`, { headers });
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
