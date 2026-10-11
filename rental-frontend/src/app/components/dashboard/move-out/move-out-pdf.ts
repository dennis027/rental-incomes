import { jsPDF } from 'jspdf';
import { INK, MUTED, PANEL, Rgb, SOFT_TEXT, TEXT, WHITE, pdfKit } from '../../../shared/pdf-kit';
import { longDate, money } from '../../../shared/share';

const ACCENT: Rgb = [70, 95, 255];
const SOFT: Rgb = [236, 243, 255];

/** The move-out settlement: deposit held, what is taken off it, and what goes back to the tenant. */
export function buildMoveOutPdf(settlement: any): jsPDF {
  const kit = pdfKit(ACCENT);
  const { pdf, left, right, width, text, wrap, label, rule, fill } = kit;
  const refund = Number(settlement.refund_amount) || 0;

  let y = kit.letterhead(settlement.property, 'MOVE-OUT STATEMENT', settlement.contract_number || '');

  label('Tenant', left, y);
  text(settlement.tenant?.name || '', left, y + 6.5, { size: 13, color: INK, bold: true });
  let partyY = y + 12;
  for (const line of [settlement.tenant?.phone, `Unit ${settlement.unit}`]) {
    if (!line) continue;
    text(line, left, partyY);
    partyY += 5;
  }
  const metaLeft = right - 78;
  let metaY = y;
  for (const [name, value] of [['Moved in', longDate(settlement.start_date)], ['Moved out', longDate(settlement.move_out_date)]]) {
    text(name, metaLeft, metaY, { color: SOFT_TEXT });
    text(value, right, metaY, { color: INK, align: 'right' });
    rule(metaY + 2.4, metaLeft);
    metaY += 7;
  }
  y = Math.max(partyY, metaY) + 8;

  fill(SOFT, left, y, width, 9);
  text('DEPOSIT SETTLEMENT', left + 4, y + 5.8, { size: 7.5, color: ACCENT, bold: true });
  text('AMOUNT (KES)', right - 4, y + 5.8, { size: 7.5, color: ACCENT, bold: true, align: 'right' });
  y += 9;
  const lines: [string, string, number][] = [
    ['Deposit held', 'Rent, water and electricity deposits', Number(settlement.deposit_held)],
    ['Less unpaid rent and bills', 'Balance on the account at move-out', -Number(settlement.unpaid_balance)],
    ['Less deductions', settlement.deduction_notes || 'Repairs and other charges', -Number(settlement.deductions)],
  ];
  for (const [name, detail, amount] of lines) {
    const detailLines = wrap(detail, width - 60, 8).slice(0, 3);
    const height = 8 + detailLines.length * 4;
    text(name, left + 4, y + 5.8, { color: INK });
    text(detailLines, left + 4, y + 9.8, { size: 8, color: MUTED });
    text(amount < 0 ? `- ${money(-amount)}` : money(amount), right - 4, y + 5.8, { color: INK, align: 'right' });
    rule(y + height);
    y += height;
  }

  y += 6;
  fill(refund >= 0 ? ACCENT : [217, 45, 32], right - 95, y, 95, 11, 2);
  text(refund >= 0 ? 'Refund to tenant' : 'Still owed by tenant', right - 91, y + 7.2, { size: 11.5, color: WHITE, bold: true });
  text(`KES ${money(Math.abs(refund))}`, right - 4, y + 7.2, { size: 11.5, color: WHITE, bold: true, align: 'right' });
  y += 21;

  const note = refund >= 0
    ? `The deposit has been settled as shown above. KES ${money(refund)} is refunded to the tenant.`
    : `The deposit did not cover what was owed. KES ${money(-refund)} remains payable by the tenant.`;
  const noteLines = wrap(note, width - 10, 9.5);
  fill(PANEL, left, y, width, noteLines.length * 4.6 + 6);
  fill(ACCENT, left, y, 0.9, noteLines.length * 4.6 + 6);
  text(noteLines, left + 5, y + 6.2, { size: 9.5, color: TEXT });
  y += noteLines.length * 4.6 + 26;

  // Both sides sign the settlement
  for (const [name, x] of [['Landlord / agent', left], ['Tenant', left + width / 2 + 6]] as [string, number][]) {
    rule(y, x, x + width / 2 - 6);
    text(name, x, y + 5, { size: 8.5, color: SOFT_TEXT });
    text('Signature and date', x + width / 2 - 6, y + 5, { size: 8.5, color: MUTED, align: 'right' });
  }
  return pdf;
}
