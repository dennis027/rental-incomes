import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { SharedImports } from '../../../shared-imports/imports';
import { environment } from '../../../../environments/environment';

export interface StkPushData {
  invoiceId: number;
  customerName: string;
  phone: string;
  amount: number | string;
  unit: string;
}

interface StkRequest {
  id: number;
  status: 'pending' | 'paid' | 'failed';
  result_desc: string;
  mpesa_receipt: string;
  amount: number;
  phone: string;
}

/** Whether "pay now" prompts are set up on the server */
export function stkConfigured(http: HttpClient): Observable<{ configured: boolean }> {
  return http.get<{ configured: boolean }>(`${environment.apiUrl}api/mpesa/stk/`);
}

/** Opens the dialog; resolves true once the tenant has paid */
export function openStkPush(dialog: MatDialog, data: StkPushData): Observable<boolean | undefined> {
  return dialog.open(StkPushDialog, { data, disableClose: true }).afterClosed();
}

/** Sends a tenant an M-Pesa payment prompt and waits for their answer */
@Component({
  selector: 'app-stk-push-dialog',
  imports: [SharedImports],
  templateUrl: './stk-push-dialog.html',
  styleUrl: './stk-push-dialog.css'
})
export class StkPushDialog implements OnDestroy {
  data = inject<StkPushData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<StkPushDialog>);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private api = `${environment.apiUrl}api/mpesa/stk/`;

  form = this.fb.group({
    phone: [this.data.phone, [Validators.required, Validators.pattern(/^\+?[0-9 ]{9,15}$/)]],
    amount: [Math.ceil(Number(this.data.amount) || 0), [Validators.required, Validators.min(1)]],
  });

  stage: 'form' | 'waiting' | 'paid' | 'failed' = 'form';
  sending = false;
  error = '';
  request: StkRequest | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private started = 0;

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.sending = true;
    this.error = '';
    this.http.post<StkRequest>(this.api, { receipt: this.data.invoiceId, ...this.form.getRawValue() }).subscribe({
      next: request => {
        this.sending = false;
        this.request = request;
        this.stage = 'waiting';
        this.started = Date.now();
        this.timer = setInterval(() => this.poll(), 3000);
        this.cdr.markForCheck();
      },
      error: err => {
        this.sending = false;
        const body = err.error ?? {};
        this.error = body.error || body.phone?.[0] || body.amount?.[0] || 'The prompt could not be sent.';
        this.cdr.markForCheck();
      }
    });
  }

  private poll(): void {
    if (!this.request) {
      return;
    }
    // Safaricom gives up on an unanswered prompt after about a minute
    if (Date.now() - this.started > 120_000) {
      this.stop();
      this.stage = 'failed';
      this.error = 'No answer from the tenant yet. If they pay later it will still be recorded.';
      this.cdr.markForCheck();
      return;
    }
    this.http.get<StkRequest>(`${this.api}${this.request.id}/`).subscribe(request => {
      this.request = request;
      if (request.status !== 'pending') {
        this.stop();
        this.stage = request.status;
        this.error = request.status === 'failed' ? (request.result_desc || 'The tenant did not pay.') : '';
      }
      this.cdr.markForCheck();
    });
  }

  tryAgain(): void {
    this.stage = 'form';
    this.error = '';
  }

  close(): void {
    this.ref.close(this.stage === 'paid');
  }

  private stop(): void {
    clearInterval(this.timer);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
