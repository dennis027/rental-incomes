import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReceiptService {
  private receiptsURL = `${environment.apiUrl}api/receipts/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** 🔹 Get All Receipts or a Specific Receipt */
  getReceipts(id?: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = id ? `${this.receiptsURL}${id}/` : this.receiptsURL;
    return this.http.get<any>(url, { headers });
  }

  /** 🔹 Create New Receipt */
  addReceipt(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(this.receiptsURL, data, { headers });
  }

  /** 🔹 Update Existing Receipt */
  updateReceipt(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.put<any>(`${this.receiptsURL}${id}/`, data, { headers });
  }

  /** 🔹 Delete Receipt */
  deleteReceipt(id: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete<any>(`${this.receiptsURL}${id}/`, { headers });
  }

  addMonthlyReceipts(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(`${this.receiptsURL}generate-receipts/`, data, { headers });
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
