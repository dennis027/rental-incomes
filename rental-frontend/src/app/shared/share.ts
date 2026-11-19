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

/** Phones and tablets, where the WhatsApp app is installed. Prerendered pages count as mobile (wa.me). */
function onMobile(): boolean {
  return typeof navigator === 'undefined' || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Open WhatsApp with the message ready to send. With no phone number the user picks the chat.
 * Phones get wa.me, which opens the WhatsApp app. Computers go straight to WhatsApp Web:
 * wa.me there tries to hand off to a desktop app, and on a computer without one (Linux
 * has none) the browser only shows "no app can open this link".
 */
export function whatsappLink(phone: string | null | undefined, message: string): string {
  const number = whatsappNumber(phone);
  const text = encodeURIComponent(message);
  if (onMobile()) {
    return `https://wa.me/${number}?text=${text}`;
  }
  return number
    ? `https://web.whatsapp.com/send?phone=${number}&text=${text}`
    : `https://web.whatsapp.com/send?text=${text}`;
}

export function openWhatsApp(phone: string | null | undefined, message: string): void {
  window.open(whatsappLink(phone, message), '_blank', 'noopener');
}

/** Open the PDF with the print dialog showing. Falls back to a download when the new tab is blocked. */
export function printPdf(pdf: jsPDF, filename: string): void {
  pdf.autoPrint();
  const opened = window.open(pdf.output('bloburl') as unknown as string, '_blank');
  if (!opened) {
    pdf.save(filename);
  }
}
