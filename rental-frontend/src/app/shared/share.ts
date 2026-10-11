import type { jsPDF } from 'jspdf';

export const money = (value: any) =>
  (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const longDate = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Kenyan numbers as WhatsApp wants them: 254 followed by nine digits. Other numbers are passed through. */
export function whatsappNumber(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.length === 9 && /^[17]/.test(digits)) return '254' + digits;
  return digits;
}

/** Open WhatsApp with the message ready to send. With no phone number the user picks the chat. */
export function openWhatsApp(phone: string | null | undefined, message: string): void {
  const number = whatsappNumber(phone);
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

/** Open the PDF with the print dialog showing. Falls back to a download when the new tab is blocked. */
export function printPdf(pdf: jsPDF, filename: string): void {
  pdf.autoPrint();
  const opened = window.open(pdf.output('bloburl') as unknown as string, '_blank');
  if (!opened) {
    pdf.save(filename);
  }
}
