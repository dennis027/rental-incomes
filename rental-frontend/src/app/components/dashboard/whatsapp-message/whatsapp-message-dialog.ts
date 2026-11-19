import { ChangeDetectorRef, Component, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { SharedImports } from '../../../shared-imports/imports';
import { environment } from '../../../../environments/environment';

export interface WhatsAppMessageData {
  phone: string | null | undefined;
  /** Prefilled text; the user can change it before sending */
  message: string;
  /** Shown in the header */
  recipientName?: string;
  /** Keeps the message in that tenancy's log */
  contractId?: number | null;
}

/** WhatsApp lets a message variable hold about this much; the server trims to the same */
export const WHATSAPP_MESSAGE_MAX = 900;

/** Opens the dialog; resolves true once the message was sent */
export function openWhatsAppMessage(dialog: MatDialog, data: WhatsAppMessageData): Observable<boolean | undefined> {
  return dialog.open(WhatsAppMessageDialog, { data, width: '560px', maxWidth: '95vw' }).afterClosed();
}

/** For pages that only need "compose a WhatsApp to this tenant" */
@Injectable({ providedIn: 'root' })
export class WhatsAppComposer {
  private dialog = inject(MatDialog);

  compose(phone: string | null | undefined, message: string, extra: Omit<WhatsAppMessageData, 'phone' | 'message'> = {}) {
    return openWhatsAppMessage(this.dialog, { phone, message, ...extra });
  }
}

/**
 * Shows the message that will go to the tenant, lets the user edit it, and
 * sends it from the business WhatsApp number through KodiDesk.
 */
@Component({
  selector: 'app-whatsapp-message-dialog',
  imports: [SharedImports],
  templateUrl: './whatsapp-message-dialog.html',
  styleUrl: './whatsapp-message-dialog.css'
})
export class WhatsAppMessageDialog {
  data = inject<WhatsAppMessageData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<WhatsAppMessageDialog>);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);

  readonly max = WHATSAPP_MESSAGE_MAX;
  readonly accountName = this.readAccountName();

  form = this.fb.group({
    phone: [this.data.phone ?? '', [Validators.required, Validators.pattern(/^\+?[0-9 ]{9,15}$/)]],
    message: [this.data.message, [Validators.required, Validators.maxLength(WHATSAPP_MESSAGE_MAX)]],
  });

  stage: 'edit' | 'sent' = 'edit';
  sending = false;
  error = '';

  get length(): number {
    return (this.form.get('message')?.value ?? '').length;
  }

  /** What the tenant sees: the approved template around the text */
  get preview(): string {
    const text = (this.form.get('message')?.value ?? '').replace(/\s+/g, ' ').trim();
    return `Message from ${this.accountName}: ${text} Reply to this chat if you have any questions.`;
  }

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.sending = true;
    this.error = '';
    const { phone, message } = this.form.getRawValue();
    this.http.post<{ sent: boolean }>(`${environment.apiUrl}api/reminders/whatsapp/`, {
      phone, message, contract_id: this.data.contractId ?? null,
    }).subscribe({
      next: () => {
        this.sending = false;
        this.stage = 'sent';
        this.cdr.markForCheck();
      },
      error: err => {
        this.sending = false;
        const body = err.error ?? {};
        this.error = body.error || body.phone?.[0] || body.message?.[0] ||
          (err.status === 403 ? 'Your role does not allow sending messages.' : 'The message could not be sent. Check your connection and try again.');
        this.cdr.markForCheck();
      }
    });
  }

  close(): void {
    this.ref.close(this.stage === 'sent');
  }

  private readAccountName(): string {
    try {
      return localStorage.getItem('account_name') || 'your landlord';
    } catch {
      return 'your landlord';
    }
  }
}
