import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ExpensesService {
  private expensesURL = `${environment.apiUrl}api/expenses/`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** 🔹 Get All Expenses */
  getExpenses(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(this.expensesURL, { headers });
  }

  /** 🔹 Add New Expense (POST /api/expenses/) */
  addExpense(data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post<any>(this.expensesURL, data, { headers });
  }

  /** 🔹 Update Expense (PUT /api/expenses/:id/) */
  updateExpense(id: string | number, data: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.put<any>(`${this.expensesURL}${id}/`, data, { headers });
  }

  /** 🔹 Delete Expense (DELETE /api/expenses/:id/) */
  deleteExpense(id: string | number): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete<any>(`${this.expensesURL}${id}/`, { headers });
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
