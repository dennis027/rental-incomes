import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private paymentsURL = `${environment.apiUrl}api/payments/`;

  /** 🔹 Get All Payments or a Specific Payment */
  getPayments(id?: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = id ? `${this.paymentsURL}${id}/` : this.paymentsURL;
    
    console.log('📡 PaymentService: Fetching payments from:', url);
    console.log('📡 PaymentService: Has Authorization header:', headers.has('Authorization'));
    
    return this.http.get<any>(url, { headers });
  }

  /** 🔹 Add New Payment (Make Payment) */
  makePayment(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    
    console.log('📡 PaymentService: Making payment');
    console.log('📡 PaymentService: Has Authorization header:', headers.has('Authorization'));
    
    return this.http.post<any>(this.paymentsURL, data, { headers });
  }

  /** 🔹 Update Payment (if applicable) */
  updatePayment(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    
    console.log('📡 PaymentService: Updating payment:', id);
    console.log('📡 PaymentService: Has Authorization header:', headers.has('Authorization'));
    
    return this.http.put<any>(`${this.paymentsURL}${id}/`, data, { headers });
  }

  /** 🔹 Delete Payment */
  deletePayment(id: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    
    console.log('📡 PaymentService: Deleting payment:', id);
    console.log('📡 PaymentService: Has Authorization header:', headers.has('Authorization'));
    
    return this.http.delete<any>(`${this.paymentsURL}${id}/`, { headers });
  }

  /** 🔹 Helper: Construct Headers with Bearer Token */
  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    const accessToken = this.getAccessToken();
    
    if (accessToken) {
      headers = headers.set('Authorization', `Bearer ${accessToken}`);
      console.log('🔐 PaymentService: Token added to headers');
    } else {
      console.warn('⚠️ PaymentService: No access token available!');
    }

    return headers;
  }

  /** 🔹 Helper: Safely Retrieve Token from LocalStorage (Browser Only) */
  private getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      console.log('🔍 PaymentService: Platform is browser, token:', token ? 'exists' : 'null');
      return token;
    }
    console.log('⚠️ PaymentService: Platform is server, returning null');
    return null;
  }
}