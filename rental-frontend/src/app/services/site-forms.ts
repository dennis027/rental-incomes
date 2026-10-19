import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FormReply {
  success: boolean;
  message?: string;
}

/** The public website's forms; each submission is emailed to the business. */
@Injectable({ providedIn: 'root' })
export class SiteFormsService {
  private http = inject(HttpClient);

  sendContact(body: {
    name: string; email: string; phone?: string; subject?: string; message: string; website?: string;
  }): Observable<FormReply> {
    return this.http.post<FormReply>(`${environment.apiUrl}api/contact/`, body);
  }

  requestDemo(body: {
    first_name: string; last_name: string; email: string; phone: string;
    role: string; units: string; source?: string; website?: string;
  }): Observable<FormReply> {
    return this.http.post<FormReply>(`${environment.apiUrl}api/request-demo/`, body);
  }
}

/** A readable message for a failed form request. */
export function formErrorMessage(err: any): string {
  if (err?.status === 0) return "We couldn't reach the server. Check your connection and try again.";
  return err?.error?.message || 'Something went wrong. Please try again.';
}
