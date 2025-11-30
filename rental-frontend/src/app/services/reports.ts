import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class ReportsService {
    private reportsAPI = `${environment.apiUrl}api/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}


  // Financial Reports


  getTotalRevenue (propertyId:any,start_date:any,end_date:any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}revenue/total/?property_id=${propertyId}&start_date=${start_date}&end_date=${end_date}`, { headers });
  }

  getOutstandingPayments (propertyId:any,min_balance:any,status:any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}balances/outstanding/?property_id=${propertyId}&min_balance=${min_balance}0&status=${status}`, { headers });
  }

  totalCollections (propertyId:any,start_date:any,end_date:any,groupBy:any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}payments/collections/?property_id=${propertyId}&start_date=${start_date}&end_date=${end_date}&group_by=${groupBy}`, { headers });

  }

  rentRoll(propertyId:any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}rent-roll/?property_id=${propertyId}`, { headers });
  } 

  depositTracking(propertyId:any,start_date:any,end_date:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}deposits/tracking/?property_id=${propertyId}&start_date=${start_date}&end_date=${end_date}`, { headers });
  } 

  expensesAnalysis(propertyId:any,start_date:any,end_date:any,groupBy:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}expenses/analysis/?property_id=${propertyId}&start_date=${start_date}&end_date=${end_date}`, { headers });
  }

  profitLoss():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}profit-loss/`, { headers });
  }

  paymentMethods():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}payments/methods/`, { headers });
  }

  getDefaulters(propertyId:any,min_balance:any,days_overdue:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}defaulters/?property_id=${propertyId}&min_balance=${min_balance}&days_overdue=${days_overdue}`, { headers });
  }

  revenueForecast(property_id:any,months:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}revenue/forecast/?property_id=${property_id}&months=${months}`, { headers });
  }

  // occupancy and unit reports


  occupancyRate():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}occupancy/rate/`, { headers });
  }

  unitsPerfomance(property_id:any,order_by:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}units/performance/?property_id=${property_id}&order_by=${order_by}`, { headers });
  }

  vacancyDuration(property_id:any,min_days:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}vacancy/duration/?property_id=${property_id}&min_days=${min_days}`, { headers });
  }

  typesAnalysis():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}units/type-analysis/`, { headers });
  }

  tenantsMovement():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}tenant-movement/`, { headers });
  }

  rentPricing():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}rent/pricing/`, { headers });
  }

  unitsUtilizations(propertyID:any,months:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}units/utilization/?months=${months}&property_id=${propertyID}`, { headers });
  }


  unitsAvailable(propertyID:any,unit_type:any,max_rent:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}units/available/?property_id=${propertyID}&unit_type=${unit_type}&max_rent=${max_rent}`, { headers });
  }

  // tenants and customer reports

  tenantDirectory(propertyID:any,is_active:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}tenants/directory/?property_id=${propertyID}&is_active=${is_active}`, { headers });
  }

  paymentHistory(tenantID:any){
      const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}tenants/${tenantID}/payment-history/`, { headers });
  }

  areasAgigng():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}tenants/arrears-aging/`, { headers });
  }

  contractsExpiring(propertyID:any,days:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}contracts/expiring/?property_id=${propertyID}&days=${days}`, { headers });
  }

  tenantsNew(days:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}tenants/new/?days=${days}`, { headers });
  }

  tenatsRetention():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}tenants/retention/`, { headers });
  }

  // utility and maintance reports

  utilityConsumption():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}utilities/consumption/`, { headers });
  }

  utilityRevenue():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}utilities/revenue/`, { headers });
  }

  maintenanceRequests(propertyID:any,status:any,start_date:any,end_date:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}maintenance/requests/?property_id=${propertyID}&status=${status}&start_date=${start_date}&end_date=${end_date}`, { headers });
  }

  maintenanceCost(propertyID:any,days:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}maintenance/costs/?days=${days}&property_id=${propertyID}`, { headers });
  }

  // executive reports

  dashboardSummary(propertyID:any,period:any):Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}dashboard/executive/?property_id=${propertyID}&period=${period}`, { headers });
  }


  propertyComparison():Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.reportsAPI}properties/comparison/`, { headers });
  }




  /** 🔹 Helper: Safely Retrieve Token from LocalStorage (Browser Only) */
  private getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token');
    }
    return null;

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
}
