import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private apiUrl = `${environment.apiUrl}/api/dashboard`;

  getDashboardSummary(propertyId?: string): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('property_id', propertyId);
    }
    return this.http.get<DashboardSummary>(`${this.apiUrl}/summary/`, { params });
  }

  getMonthlyCollection(propertyId?: string, months: number = 6): Observable<MonthlyCollection[]> {
    let params = new HttpParams().set('months', months.toString());
    if (propertyId) {
      params = params.set('property_id', propertyId);
    }
    return this.http.get<MonthlyCollection[]>(`${this.apiUrl}/monthly-collection/`, { params });
  }

  getOccupancyStats(propertyId?: string): Observable<OccupancyStats> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('property_id', propertyId);
    }
    return this.http.get<OccupancyStats>(`${this.apiUrl}/occupancy/`, { params });
  }

  getPaymentMethodsBreakdown(propertyId?: string): Observable<PaymentMethodsBreakdown> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('property_id', propertyId);
    }
    return this.http.get<PaymentMethodsBreakdown>(`${this.apiUrl}/payment-methods/`, { params });
  }

  getRevenueVsExpenses(propertyId?: string, months: number = 12): Observable<RevenueExpense[]> {
    let params = new HttpParams().set('months', months.toString());
    if (propertyId) {
      params = params.set('property_id', propertyId);
    }
    return this.http.get<RevenueExpense[]>(`${this.apiUrl}/revenue-expenses/`, { params });
  }
}
