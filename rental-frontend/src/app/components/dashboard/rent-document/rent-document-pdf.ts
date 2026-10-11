import { jsPDF } from 'jspdf';
import type { RentDocumentData } from './rent-document';

type Rgb = [number, number, number];

const INK: Rgb = [16, 24, 40];
const TEXT: Rgb = [71, 84, 103];
const MUTED: Rgb = [152, 162, 179];
const RULE: Rgb = [228, 231, 236];
const PANEL: Rgb = [249, 250, 251];
const WHITE: Rgb = [255, 255, 255];

const THEMES: Record<RentDocumentData['kind'], { accent: Rgb; soft: Rgb }> = {
  invoice: { accent: [70, 95, 255], soft: [236, 243, 255] },
  receipt: { accent: [3, 152, 85], soft: [236, 253, 243] },
};

const STATUS: Record<RentDocumentData['status'], { label: string; text: Rgb; fill: Rgb }> = {
  paid: { label: 'Paid', text: [3, 152, 85], fill: [236, 253, 243] },
  partial: { label: 'Partly paid', text: [220, 104, 3], fill: [255, 250, 235] },
  unpaid: { label: 'Unpaid', text: [217, 45, 32], fill: [254, 243, 242] },
};

const METHODS: Record<string, string> = { mpesa: 'M-Pesa', cash: 'Cash', bank: 'Bank transfer' };

const money = (value: number) =>
  (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const longDate = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Draws the invoice or receipt straight onto an A4 page.
 * The page is drawn, not photographed from the screen, so the text stays sharp
 * and the result does not depend on how the browser renders the preview.
 */
export function buildRentDocumentPdf(doc: RentDocumentData): jsPDF {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const { accent, soft } = THEMES[doc.kind];
  const isInvoice = doc.kind === 'invoice';
  const left = 18;
  const right = 210 - 18;
  const width = right - left;

  const text = (
    value: string, x: number, y: number,
    opts: { size?: number; color?: Rgb; bold?: boolean; align?: 'left' | 'right' | 'center'; font?: string } = {}
  ) => {
    pdf.setFont(opts.font ?? 'helvetica', opts.bold ? 'bold' : 'normal');
    pdf.setFontSize(opts.size ?? 10);
    pdf.setTextColor(...(opts.color ?? TEXT));
    pdf.text(value, x, y, { align: opts.align ?? 'left' });
  };
  const label = (value: string, x: number, y: number, align: 'left' | 'center' = 'left') =>
    text(value.toUpperCase(), x, y, { size: 7.5, color: MUTED, bold: true, align });
  const rule = (y: number, x1 = left, x2 = right) => {
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.2);
    pdf.line(x1, y, x2, y);
  };

  // ---------- Who it is from, and what kind of document this is ----------
  let y = 20;
  pdf.setFillColor(...accent);
  pdf.roundedRect(left, y, 13, 13, 3, 3, 'F');
  text((doc.property.name || '?').charAt(0).toUpperCase(), left + 6.5, y + 8.8, { size: 16, color: WHITE, bold: true, align: 'center' });
  text(doc.property.name || '', left + 17, y + 5.5, { size: 14, color: INK, bold: true });
  if (doc.property.address) {
    const address = pdf.splitTextToSize(doc.property.address.replace(/\s+/g, ' '), 80).slice(0, 2);
    text(address, left + 17, y + 10.5, { size: 9 });
  }
  text(isInvoice ? 'INVOICE' : 'PAYMENT RECEIPT', right, y + 6.5, { size: 20, color: accent, bold: true, align: 'right' });
  text(doc.number, right, y + 12, { size: 9.5, color: [52, 64, 84], align: 'right', font: 'courier' });

  y += 21;
  pdf.setFillColor(...RULE);
  pdf.roundedRect(left, y, width, 1.2, 0.6, 0.6, 'F');
  pdf.setFillColor(...accent);
  pdf.roundedRect(left, y, width * 0.22, 1.2, 0.6, 0.6, 'F');

  // ---------- Who it is for, and the dates ----------
  y += 11;
  label(isInvoice ? 'Billed to' : 'Received from', left, y);
  text(doc.tenant.name || '', left, y + 6.5, { size: 13, color: INK, bold: true });
  let partyY = y + 12;
  for (const line of [doc.tenant.phone, `Unit ${doc.unit}`]) {
    if (!line) continue;
    text(line, left, partyY);
    partyY += 5;
  }

  const metaLeft = right - 78;
  const status = isInvoice ? STATUS[doc.status] ?? STATUS.unpaid : { ...STATUS.paid, label: 'Received' };
  const meta: [string, string][] = [[isInvoice ? 'Invoice date' : 'Payment date', longDate(doc.date)]];
  if (isInvoice && doc.dueDate) meta.push(['Due date', longDate(doc.dueDate)]);
  if (doc.contractNumber) meta.push(['Contract', doc.contractNumber]);
  let metaY = y;
  for (const [name, value] of meta) {
    text(name, metaLeft, metaY, { color: [102, 112, 133] });
    text(value, right, metaY, { color: INK, align: 'right' });
    rule(metaY + 2.4, metaLeft);
    metaY += 7;
  }
  text('Status', metaLeft, metaY, { color: [102, 112, 133] });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  const pillWidth = pdf.getTextWidth(status.label) + 6;
  pdf.setFillColor(...status.fill);
  pdf.roundedRect(right - pillWidth, metaY - 3.8, pillWidth, 5.4, 2.7, 2.7, 'F');
  text(status.label, right - pillWidth / 2, metaY, { size: 8.5, color: status.text, bold: true, align: 'center' });
  rule(metaY + 2.4, metaLeft);

  y = Math.max(partyY, metaY + 7) + 8;

  // ---------- Body ----------
  if (isInvoice) {
    pdf.setFillColor(...soft);
    pdf.rect(left, y, width, 9, 'F');
    text('DESCRIPTION', left + 4, y + 5.8, { size: 7.5, color: accent, bold: true });
    text('AMOUNT (KES)', right - 4, y + 5.8, { size: 7.5, color: accent, bold: true, align: 'right' });
    y += 9;
    for (const line of doc.lines) {
      const rowHeight = line.detail ? 12 : 9;
      text(line.label, left + 4, y + 5.8, { color: INK });
      if (line.detail) text(line.detail, left + 4, y + 9.8, { size: 8, color: MUTED });
      text(money(line.amount), right - 4, y + 5.8, { color: INK, align: 'right' });
      rule(y + rowHeight);
      y += rowHeight;
    }
  } else if (doc.payment) {
    pdf.setFillColor(...soft);
    pdf.roundedRect(left, y, width, 26, 3, 3, 'F');
    label('Amount received', 105, y + 8.5, 'center');
    text(`KES ${money(doc.payment.amount)}`, 105, y + 19.5, { size: 24, color: accent, bold: true, align: 'center' });
    y += 31;
    const rows: [string, string][] = [
      ['Paid by', METHODS[doc.payment.method] ?? doc.payment.method ?? ''],
      ['Payment reference', doc.payment.reference || '-'],
      ['For invoice', doc.payment.invoiceNumber],
    ];
    for (const [name, value] of rows) {
      text(name, left + 4, y + 5.8, { color: [102, 112, 133] });
      text(value, right - 4, y + 5.8, { color: INK, bold: true, align: 'right' });
      rule(y + 9);
      y += 9;
    }
  }

  // ---------- Totals ----------
  y += 6;
  const totalsLeft = right - 85;
  const totals: [string, number][] = isInvoice
    ? [['Total', doc.total], ['Paid so far', doc.paid]]
    : [['Invoice total', doc.total], ['Paid to date', doc.paid]];
  for (const [name, value] of totals) {
    text(name, totalsLeft + 4, y + 4);
    text(money(value), right - 4, y + 4, { align: 'right' });
    y += 7;
  }
  y += 1;
  pdf.setFillColor(...accent);
  pdf.roundedRect(totalsLeft, y, 85, 11, 2, 2, 'F');
  const credit = !isInvoice && doc.balance < 0;
  text(isInvoice ? 'Balance due' : credit ? 'Credit on account' : 'Balance remaining', totalsLeft + 4, y + 7.2, { size: 11.5, color: WHITE, bold: true });
  text(`KES ${money(credit ? -doc.balance : doc.balance)}`, right - 4, y + 7.2, { size: 11.5, color: WHITE, bold: true, align: 'right' });
  y += 11;

  // ---------- Note ----------
  let note: string;
  if (isInvoice) {
    note = doc.balance > 0
      ? `Please pay the balance due${doc.dueDate ? ' by ' + longDate(doc.dueDate) : ''} and quote invoice number ${doc.number} as your payment reference. A receipt is issued for every payment.`
      : 'This invoice has been paid in full. Thank you.';
  } else {
    const invoice = doc.payment?.invoiceNumber ?? '';
    note = 'Received with thanks. ' + (doc.balance > 0
      ? `A balance of KES ${money(doc.balance)} remains on invoice ${invoice}.`
      : doc.balance < 0
        ? `Invoice ${invoice} is fully paid. The extra KES ${money(-doc.balance)} is held as credit and taken off the next invoice.`
        : `Invoice ${invoice} is now fully paid.`);
  }
  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  const noteLines: string[] = pdf.splitTextToSize(note, width - 10);
  const noteHeight = noteLines.length * 4.6 + 6;
  pdf.setFillColor(...PANEL);
  pdf.rect(left, y, width, noteHeight, 'F');
  pdf.setFillColor(...accent);
  pdf.rect(left, y, 0.9, noteHeight, 'F');
  pdf.setTextColor(...TEXT);
  pdf.text(noteLines, left + 5, y + 6.2, { lineHeightFactor: 1.37 });
  y += noteHeight;

  // ---------- Footer ----------
  y += 12;
  rule(y);
  text(doc.property.name || '', left, y + 5, { size: 8, color: MUTED });
  text(
    isInvoice ? 'This is a request for payment, not a receipt.' : 'This receipt confirms payment and is not a request for payment.',
    right, y + 5, { size: 8, color: MUTED, align: 'right' }
  );

  return pdf;
}
