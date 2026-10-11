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
  private unitsURL = `${environment.apiUrl}api/units/`;

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

  /** 🔹 Helper: Construct Headers with Bearer Token */
  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    const accessToken = this.getAccessToken();
    if (accessToken) {
      headers = headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return headers;
  }
  /** 🔹 Generate Monthly Receipts (Simple - No Meter Readings) */
  addMonthlyReceipts(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(`${this.receiptsURL}generate-monthly-receipts/`, data, { headers });
  }

  /** 🔹 Get Active Units for Property (For Meter Readings Collection) */
  getActiveUnitsForProperty(propertyId: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.unitsURL}active/?property_id=${propertyId}`, { headers });
  }

  /** 🔹 Generate Monthly Receipts with Meter Readings */
  addMonthlyReceiptsWithReadings(data: {
    month: string;
    property_id: string | number;
    meter_readings: Array<{
      unit_id: number;
      contract_id: number;
      previous_balance: number;
      current_water_reading: number;
      current_electricity_reading: number;
      water_bill: number;
      electricity_bill: number;
      service_charge: number;
      security_charge: number;
      other_charges: number;
    }>;
  }): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(
      `${this.receiptsURL}generate-monthly-with-readings/`,
      data,
      { headers }
    );
  }

  /** 🔹 Helper: Safely Retrieve Token from LocalStorage (Browser Only) */
  private getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token');
    }
    return null;
  }
}
