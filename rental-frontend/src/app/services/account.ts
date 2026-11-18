import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type Role = 'owner' | 'manager' | 'accountant' | 'caretaker';

export const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'owner', label: 'Owner', hint: 'Everything, including the team.' },
  { value: 'manager', label: 'Property manager', hint: 'Everything except changing the team.' },
  { value: 'accountant', label: 'Accountant', hint: 'Sees everything; records invoices, payments and expenses.' },
  { value: 'caretaker', label: 'Caretaker', hint: 'Units, tenants and repairs. No money.' },
];

export interface TeamMember {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  role_label: string;
  is_active: boolean;
}

export interface AccountSettings {
  id: number;
  name: string;
  sms_reminders_enabled: boolean;
  sms_days_before_due: number;
  sms_overdue_every_days: number;
  paybill_validation_url: string;
  paybill_confirmation_url: string;
  sms_configured: boolean;
}

/** The signed-in user's account and its team */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private api = environment.apiUrl + 'api/';

  me(): Observable<TeamMember & { account: { id: number; name: string } }> {
    return this.http.get<any>(`${this.api}me/`);
  }

  account(): Observable<AccountSettings> {
    return this.http.get<AccountSettings>(`${this.api}account/`);
  }

  updateAccount(changes: Partial<AccountSettings>): Observable<AccountSettings> {
    return this.http.patch<AccountSettings>(`${this.api}account/`, changes);
  }

  team(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.api}team/`);
  }

  addMember(member: { username: string; email: string; first_name?: string; last_name?: string; role: Role }): Observable<TeamMember> {
    return this.http.post<TeamMember>(`${this.api}team/`, member);
  }

  changeRole(id: number, role: Role): Observable<TeamMember> {
    return this.http.patch<TeamMember>(`${this.api}team/${id}/`, { role });
  }

  removeMember(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}team/${id}/`);
  }
}

/** Dashboard pages a caretaker can open; every other role opens them all */
const CARETAKER_PAGES = ['/dashboard/properties', '/dashboard/units', '/dashboard/rental-customers',
  '/dashboard/contracts', '/dashboard/expensesmaintain'];

/** The role saved at sign-in. Accounts from before roles existed are owners. */
export function currentRole(): Role {
  try {
    return (localStorage.getItem('user_role') as Role) || 'owner';
  } catch {
    return 'owner';
  }
}

export function roleCanOpen(role: Role, url: string): boolean {
  if (url.startsWith('/dashboard/team')) {
    return role === 'owner' || role === 'manager';
  }
  if (role === 'caretaker') {
    return CARETAKER_PAGES.some(page => url.startsWith(page));
  }
  return true;
}

/** Where a role lands after signing in */
export function homeFor(role: Role): string {
  return role === 'caretaker' ? '/dashboard/units' : '/dashboard/home';
}
