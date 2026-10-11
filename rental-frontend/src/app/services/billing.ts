import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Statements, arrears, move-out settlements, contracts ending soon and paybill payments. */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private api = `${environment.apiUrl}api/`;

  statement(customerId: number, filters: { contract_id?: number | string; start_date?: string; end_date?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.api}customers/${customerId}/statement/`, { headers: this.headers(), params: this.params(filters) });
  }

  arrears(propertyId?: number | string | null): Observable<any> {
    return this.http.get<any>(`${this.api}arrears/`, { headers: this.headers(), params: this.params({ property_id: propertyId }) });
  }

  contractsEndingSoon(propertyId?: number | string | null, days = 60): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}contracts/ending-soon/`, { headers: this.headers(), params: this.params({ property_id: propertyId, days }) });
  }

  moveOutPreview(contractId: number): Observable<any> {
    return this.http.get<any>(`${this.api}contracts/${contractId}/move-out/`, { headers: this.headers() });
  }

  moveOut(contractId: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.api}contracts/${contractId}/move-out/`, data, { headers: this.headers() });
  }

  paybillTransactions(): Observable<any> {
    return this.http.get<any>(`${this.api}paybill-transactions/`, { headers: this.headers() });
  }

  matchPaybillTransaction(id: number, invoiceId: number): Observable<any> {
    return this.http.post<any>(`${this.api}paybill-transactions/${id}/match/`, { receipt: invoiceId }, { headers: this.headers() });
  }

  private params(values: Record<string, any>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  private headers(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const token = isPlatformBrowser(this.platformId) ? localStorage.getItem('access_token') : null;
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }
}
