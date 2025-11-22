import { Injectable, inject, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

export interface DashboardSummary {
  total_tenants: number;
  occupied_units: number;
  total_units: number;
  vacant_units: number;
  pending_rent: number;
  contracts_expiring: number;
  monthly_collection: number;
  occupancy_rate: number;
}

export interface MonthlyCollection {
  month: string;
  year: number;
  amount: number;
}

export interface OccupancyStats {
  occupied: number;
  vacant: number;
  total: number;
  occupancy_percentage: number;
}

export interface PaymentMethodsBreakdown {
  cash: number;
  mpesa: number;
  bank: number;
  total: number;
}

export interface RevenueExpense {
  month: string;
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardSummaryService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/api/dashboard`;

  /** 🔹 GET Summary */
  getDashboardSummary(propertyId?: string): Observable<DashboardSummary> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams();
    if (propertyId) params = params.set('property_id', propertyId);

    return this.http.get<DashboardSummary>(`${this.apiUrl}/summary/`, { headers, params });
  }

  /** 🔹 GET Monthly Collection */
  getMonthlyCollection(propertyId?: string, months: number = 6): Observable<MonthlyCollection[]> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams().set('months', months.toString());
    if (propertyId) params = params.set('property_id', propertyId);

    return this.http.get<MonthlyCollection[]>(`${this.apiUrl}/monthly-collection/`, { headers, params });
  }

  /** 🔹 GET Occupancy Stats */
  getOccupancyStats(propertyId?: string): Observable<OccupancyStats> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams();
    if (propertyId) params = params.set('property_id', propertyId);

    return this.http.get<OccupancyStats>(`${this.apiUrl}/occupancy/`, { headers, params });
  }

  /** 🔹 GET Payment Methods Breakdown */
  getPaymentMethodsBreakdown(propertyId?: string): Observable<PaymentMethodsBreakdown> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams();
    if (propertyId) params = params.set('property_id', propertyId);

    return this.http.get<PaymentMethodsBreakdown>(`${this.apiUrl}/payment-methods/`, { headers, params });
  }

  /** 🔹 GET Revenue vs Expenses */
  getRevenueVsExpenses(propertyId?: string, months: number = 12): Observable<RevenueExpense[]> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams().set('months', months.toString());
    if (propertyId) params = params.set('property_id', propertyId);

    return this.http.get<RevenueExpense[]>(`${this.apiUrl}/revenue-expenses/`, { headers, params });
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