import { jsPDF } from 'jspdf';
import { INK, MUTED, PANEL, Rgb, SOFT_TEXT, WHITE, pdfKit } from '../../../shared/pdf-kit';
import { longDate, money } from '../../../shared/share';

const ACCENT: Rgb = [70, 95, 255];
const SOFT: Rgb = [236, 243, 255];

const shortDate = (value: string) => {
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Invoice numbers are stored with RCT-; they are shown as INV-. Receipt numbers are already RCT-. */
const reference = (entry: any) => (entry.type === 'invoice' ? String(entry.number).replace(/^RCT-/, 'INV-') : entry.number);

/** A tenant statement: every invoice and payment with a running balance. Runs onto more pages as needed. */
export function buildStatementPdf(statement: any): jsPDF {
  const kit = pdfKit(ACCENT);
  const { pdf, left, right, bottom, width, text, wrap, label, rule, fill } = kit;

  const period = statement.start_date || statement.end_date
    ? `${statement.start_date ? longDate(statement.start_date) : 'Start'} to ${longDate(statement.end_date || statement.generated_on)}`
    : `As at ${longDate(statement.generated_on)}`;
  let y = kit.letterhead(statement.property, 'STATEMENT', period);

  label('Statement for', left, y);
  text(statement.tenant?.name || '', left, y + 6.5, { size: 13, color: INK, bold: true });
  let partyY = y + 12;
  for (const line of [statement.tenant?.phone, statement.unit ? `Unit ${statement.unit}` : '']) {
    if (!line) continue;
    text(line, left, partyY);
    partyY += 5;
  }

  const closing = Number(statement.closing_balance) || 0;
  fill(ACCENT, right - 78, y - 4, 78, 20, 3);
  text(closing < 0 ? 'IN CREDIT' : 'BALANCE DUE', right - 73, y + 2.5, { size: 7.5, color: WHITE, bold: true });
  text(`KES ${money(Math.abs(closing))}`, right - 73, y + 11, { size: 15, color: WHITE, bold: true });
  y = Math.max(partyY, y + 20) + 8;

  const columns = { date: left + 3, ref: left + 26, description: left + 58, charge: right - 52, payment: right - 27, balance: right - 3 };
  const tableHead = () => {
    fill(SOFT, left, y, width, 8);
    const head = { size: 7.5, color: ACCENT, bold: true } as const;
    text('DATE', columns.date, y + 5.2, head);
    text('REFERENCE', columns.ref, y + 5.2, head);
    text('DESCRIPTION', columns.description, y + 5.2, head);
    text('CHARGES', columns.charge, y + 5.2, { ...head, align: 'right' });
    text('PAYMENTS', columns.payment, y + 5.2, { ...head, align: 'right' });
    text('BALANCE', columns.balance, y + 5.2, { ...head, align: 'right' });
    y += 8;
  };
  const row = (cells: { date?: string; ref?: string; description: string; charge?: number; payment?: number; balance: number }, bold = false) => {
    const size = 8.5;
    // Long descriptions take a second line instead of being cut off
    const description = wrap(cells.description, columns.charge - 20 - columns.description, size, bold).slice(0, 2);
    const height = description.length > 1 ? 11.5 : 8;
    if (y + height > bottom - 8) {
      pdf.addPage();
      y = 20;
      tableHead();
    }
    if (cells.date) text(cells.date, columns.date, y + 5.2, { size });
    if (cells.ref) text(cells.ref, columns.ref, y + 5.2, { size: 8, font: 'courier' });
    text(description, columns.description, y + 5.2, { size, color: INK, bold });
    if (cells.charge) text(money(cells.charge), columns.charge, y + 5.2, { size, color: INK, align: 'right' });
    if (cells.payment) text(money(cells.payment), columns.payment, y + 5.2, { size, color: [3, 152, 85], align: 'right' });
    text(money(cells.balance), columns.balance, y + 5.2, { size, color: INK, bold: true, align: 'right' });
    rule(y + height);
    y += height;
  };

  tableHead();
  if (Number(statement.opening_balance)) {
    row({ description: 'Balance brought forward', balance: Number(statement.opening_balance) }, true);
  }
  for (const entry of statement.entries ?? []) {
    row({
      date: shortDate(entry.date),
      ref: reference(entry),
      description: entry.description,
      charge: Number(entry.charge),
      payment: Number(entry.payment),
      balance: Number(entry.balance),
    });
  }
  if (!(statement.entries ?? []).length) {
    text('No invoices or payments in this period.', left + 3, y + 7, { color: MUTED });
    y += 10;
  }

  if (y + 30 > bottom) {
    pdf.addPage();
    y = 20;
  }
  y += 6;
  const totalsLeft = right - 85;
  for (const [name, value] of [['Total charged', statement.total_charged], ['Total paid', statement.total_paid]] as [string, any][]) {
    text(name, totalsLeft + 4, y + 4);
    text(money(value), right - 3, y + 4, { align: 'right' });
    y += 7;
  }
  fill(PANEL, totalsLeft, y, 85, 10, 2);
  text(closing < 0 ? 'In credit' : 'Balance due', totalsLeft + 4, y + 6.5, { size: 11, color: INK, bold: true });
  text(`KES ${money(Math.abs(closing))}`, right - 3, y + 6.5, { size: 11, color: INK, bold: true, align: 'right' });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    rule(bottom);
    text(statement.property?.name || '', left, bottom + 5, { size: 8, color: MUTED });
    text(`Page ${page} of ${pages}`, right, bottom + 5, { size: 8, color: SOFT_TEXT, align: 'right' });
  }
  return pdf;
}
