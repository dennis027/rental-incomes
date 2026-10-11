import { jsPDF } from 'jspdf';

export type Rgb = [number, number, number];

export const INK: Rgb = [16, 24, 40];
export const TEXT: Rgb = [71, 84, 103];
export const SOFT_TEXT: Rgb = [102, 112, 133];
export const MUTED: Rgb = [152, 162, 179];
export const RULE: Rgb = [228, 231, 236];
export const PANEL: Rgb = [249, 250, 251];
export const WHITE: Rgb = [255, 255, 255];

export interface TextOptions {
  size?: number;
  color?: Rgb;
  bold?: boolean;
  align?: 'left' | 'right' | 'center';
  font?: string;
}

/** An A4 page with the same letterhead and type as the invoice and receipt. */
export function pdfKit(accent: Rgb) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const left = 18;
  const right = 210 - 18;
  const bottom = 297 - 18;

  const text = (value: string | string[], x: number, y: number, opts: TextOptions = {}) => {
    pdf.setFont(opts.font ?? 'helvetica', opts.bold ? 'bold' : 'normal');
    pdf.setFontSize(opts.size ?? 10);
    pdf.setTextColor(...(opts.color ?? TEXT));
    pdf.text(value, x, y, { align: opts.align ?? 'left' });
  };
  /** Break text into lines that fit `maxWidth` at the given size. */
  const wrap = (value: string, maxWidth: number, size = 10, bold = false): string[] => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    return pdf.splitTextToSize(value, maxWidth);
  };
  const label = (value: string, x: number, y: number) =>
    text(value.toUpperCase(), x, y, { size: 7.5, color: MUTED, bold: true });
  const rule = (y: number, x1 = left, x2 = right) => {
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.2);
    pdf.line(x1, y, x2, y);
  };
  const fill = (color: Rgb, x: number, y: number, w: number, h: number, radius = 0) => {
    pdf.setFillColor(...color);
    radius ? pdf.roundedRect(x, y, w, h, radius, radius, 'F') : pdf.rect(x, y, w, h, 'F');
  };

  /** Who the document is from and what it is. Returns the y position below it. */
  const letterhead = (property: { name: string; address?: string } | null, title: string, subtitle = ''): number => {
    const name = property?.name || '';
    const y = 20;
    fill(accent, left, y, 13, 13, 3);
    text((name || '?').charAt(0).toUpperCase(), left + 6.5, y + 8.8, { size: 16, color: WHITE, bold: true, align: 'center' });
    text(name, left + 17, y + 5.5, { size: 14, color: INK, bold: true });
    if (property?.address) {
      text(wrap(property.address.replace(/\s+/g, ' '), 80, 9).slice(0, 2), left + 17, y + 10.5, { size: 9 });
    }
    text(title, right, y + 6.5, { size: 20, color: accent, bold: true, align: 'right' });
    if (subtitle) {
      text(subtitle, right, y + 12, { size: 9.5, color: [52, 64, 84], align: 'right' });
    }
    fill(RULE, left, y + 21, right - left, 1.2, 0.6);
    fill(accent, left, y + 21, (right - left) * 0.22, 1.2, 0.6);
    return y + 32;
  };

  return { pdf, left, right, bottom, width: right - left, text, wrap, label, rule, fill, letterhead };
}
