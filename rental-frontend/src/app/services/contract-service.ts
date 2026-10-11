import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContractsService {
  private contractsURL = `${environment.apiUrl}api/contracts/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** 🔹 Get All or One Contract */
  getContracts(id?: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = id ? `${this.contractsURL}${id}/` : this.contractsURL;
    return this.http.get<any>(url, { headers });
  }

  /** 🔹 Add Contract (supports FormData) */
  addContract(data: any): Observable<any> {
    const headers = this.getAuthHeaders(false); // FormData → no JSON content-type
    return this.http.post<any>(this.contractsURL, data, { headers });
  }

  /** 🔹 Update Contract */
  updateContract(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders(false);
    return this.http.put<any>(`${this.contractsURL}${id}/`, data, { headers });
  }

  /** 🔹 Delete Contract */
  deleteContract(id: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = `${this.contractsURL}${id}/`;
    return this.http.delete<any>(url, { headers });
  }

  cancelContract(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(`${this.contractsURL}${id}/cancel/`, data, { headers });
  }

  /** 🔹 Build Auth Headers (JSON by default) */
  private getAuthHeaders(json = true): HttpHeaders {
    let headers = new HttpHeaders();
    if (json) {
      headers = headers.set('Content-Type', 'application/json');
    }

    const token = this.getAccessToken();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    return headers;
  }

  /** 🔹 Retrieve Token (Browser Only) */
  private getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token');
    }
    return null;
  }
}
