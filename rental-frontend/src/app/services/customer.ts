import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomersService {
  private customersURL = `${environment.apiUrl}api/customers/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** 🔹 Get All or One Customer */
  getCustomers(id?: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = id ? `${this.customersURL}${id}/` : this.customersURL;
    return this.http.get<any>(url, { headers });
  }

  /** 🔹 Add Customer (with possible file uploads) */
  addCustomer(data: any): Observable<any> {
    const headers = this.getAuthHeaders(false); // FormData → no content-type
    return this.http.post<any>(this.customersURL, data, { headers });
  }

  /** 🔹 Update Customer (supports FormData) */
  updateCustomer(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders(false);
    return this.http.put<any>(`${this.customersURL}${id}/`, data, { headers });
  }

deleteCustomer(id: string | number): Observable<any> {
  const headers = this.getAuthHeaders();
  const url = `${this.customersURL}${id}/`;
  return this.http.delete<any>(url, { headers });
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
