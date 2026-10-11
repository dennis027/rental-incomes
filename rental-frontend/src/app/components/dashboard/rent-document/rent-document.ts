import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { buildRentDocumentPdf } from './rent-document-pdf';
import { longDate, money, openWhatsApp } from '../../../shared/share';

export interface RentDocumentLine {
  label: string;
  detail?: string;
  amount: number;
}

/**
 * What goes on a printed document.
 *  - invoice: a bill sent to the tenant. It says what is owed.
 *  - receipt: proof of one payment. It says what was received.
 */
export interface RentDocumentData {
  kind: 'invoice' | 'receipt';
  number: string;
  date: string | Date;
  dueDate?: Date | null;
  status: 'paid' | 'partial' | 'unpaid';
  property: { name: string; address?: string };
  tenant: { name: string; phone?: string };
  unit: string;
  contractNumber?: string;
  // Invoice: the charges. Receipt: left empty.
  lines: RentDocumentLine[];
  total: number;
  paid: number;
  balance: number;
  // Receipt only
  payment?: { amount: number; method: string; reference?: string; invoiceNumber: string };
}

/** Invoices are stored with an RCT- number; show them as INV- so they are not mistaken for receipts. */
export function invoiceNumber(stored: string | null | undefined): string {
  return (stored ?? '').replace(/^RCT-/, 'INV-');
}

/** Number printed on the receipt for a payment. */
export function receiptNumber(paymentId: number): string {
  return `RCT-${String(paymentId).padStart(6, '0')}`;
}

/**
 * The receipt for one payment against an invoice.
 * `paidToDate` is what the invoice had received once this payment was in, so an
 * older receipt keeps showing the balance as it stood at the time.
 */
export function receiptDocument(payment: any, invoice: any, paidToDate: number): RentDocumentData {
  const amount = (value: any) => parseFloat(value) || 0;
  const total = amount(invoice.total_amount);
  return {
    kind: 'receipt',
    number: receiptNumber(payment.id),
    date: payment.payment_date,
    status: 'paid',
    property: { name: invoice.property, address: invoice.property_address },
    tenant: { name: invoice.customer_name || payment.customer_name || invoice.customer, phone: invoice.customer_phone },
    unit: invoice.unit,
    contractNumber: invoice.contract_number,
    lines: [],
    total,
    paid: paidToDate,
    balance: Math.round((total - paidToDate) * 100) / 100,
    payment: {
      amount: amount(payment.amount),
      method: payment.method,
      reference: payment.reference,
      invoiceNumber: invoiceNumber(invoice.receipt_number),
    },
  };
}

@Component({
  selector: 'app-rent-document',
  imports: [CommonModule],
  templateUrl: './rent-document.html',
  styleUrl: './rent-document.css'
})
export class RentDocument {
  @Input() doc: RentDocumentData | null = null;
  @ViewChild('sheet') sheet!: ElementRef<HTMLElement>;

  get statusLabel(): string {
    if (!this.doc) return '';
    if (this.doc.kind === 'receipt') return 'Received';
    return { paid: 'Paid', partial: 'Partly paid', unpaid: 'Unpaid' }[this.doc.status];
  }

  methodLabel(method: string): string {
    const labels: Record<string, string> = { mpesa: 'M-Pesa', cash: 'Cash', bank: 'Bank transfer' };
    return labels[method] ?? method;
  }

  /** Send the document to the printer, on its own page without the rest of the screen. */
  print(): void {
    if (!this.doc) return;

    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);

    const frameDoc = frame.contentDocument!;
    // The page's own styles, so the printed sheet matches the preview
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('');
    frameDoc.open();
    frameDoc.write(`<!doctype html><html><head><base href="${document.baseURI}"><title>${this.doc.kind}_${this.doc.number}</title>${styles}
      <style>
        @page { size: A4; margin: 12mm; }
        html, body { margin: 0; padding: 0; background: #fff; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .sheet { width: auto !important; margin: 0 !important; border: 0 !important; padding: 0 !important; }
      </style></head><body>${this.sheet.nativeElement.outerHTML}</body></html>`);
    frameDoc.close();

    const printFrame = async () => {
      // Wait for the fonts, or the first print falls back to a system font
      try { await frameDoc.fonts?.ready; } catch { /* print anyway */ }
      const win = frame.contentWindow!;
      win.onafterprint = () => frame.remove();
      win.focus();
      win.print();
    };
    if (frameDoc.readyState === 'complete') {
      printFrame();
    } else {
      frame.contentWindow!.addEventListener('load', printFrame, { once: true });
    }
  }

  /** Open WhatsApp with the tenant's number and a summary of the document, ready to send. */
  share(): void {
    const d = this.doc;
    if (!d) return;
    const greeting = `Hello ${(d.tenant.name || '').split(' ')[0]},`;
    let message: string;
    if (d.kind === 'invoice') {
      message = `${greeting} your invoice ${d.number} for Unit ${d.unit} at ${d.property.name} is KES ${money(d.total)}. ` +
        (d.balance > 0
          ? `Balance due: KES ${money(d.balance)}${d.dueDate ? ', by ' + longDate(d.dueDate) : ''}. Please quote ${d.number} when paying.`
          : 'It is fully paid. Thank you.');
    } else {
      const reference = d.payment?.reference ? ` ${d.payment.reference}` : '';
      message = `${greeting} we have received your payment of KES ${money(d.payment?.amount)} ` +
        `(${this.methodLabel(d.payment?.method ?? '')}${reference}) for Unit ${d.unit} at ${d.property.name}. Receipt ${d.number}. ` +
        (d.balance > 0
          ? `Balance remaining on invoice ${d.payment?.invoiceNumber}: KES ${money(d.balance)}.`
          : `Invoice ${d.payment?.invoiceNumber} is now fully paid.`) + ' Thank you.';
    }
    openWhatsApp(d.tenant.phone, message);
  }

  /** Save the document as an A4 PDF. */
  download(): void {
    if (!this.doc) return;
    buildRentDocumentPdf(this.doc).save(`${this.doc.kind}_${this.doc.number}.pdf`);
  }
}
