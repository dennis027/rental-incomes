import { longDate, money, whatsappNumber } from './share';
import { invoiceNumber, receiptDocument, receiptNumber } from '../components/dashboard/rent-document/rent-document';

describe('sharing helpers', () => {
  it('turns Kenyan numbers into the form WhatsApp expects', () => {
    expect(whatsappNumber('0712345678')).toBe('254712345678');
    expect(whatsappNumber('+254 712 345 678')).toBe('254712345678');
    expect(whatsappNumber('712345678')).toBe('254712345678');
    expect(whatsappNumber('0112345678')).toBe('254112345678');
    expect(whatsappNumber(null)).toBe('');
  });

  it('formats money and dates for documents', () => {
    expect(money('31450')).toBe('31,450.00');
    expect(money(null)).toBe('0.00');
    expect(longDate('2026-10-08')).toBe('8 October 2026');
    expect(longDate(null)).toBe('');
  });
});

describe('invoice and receipt numbers', () => {
  it('shows stored RCT- invoice numbers as INV-', () => {
    expect(invoiceNumber('RCT-7-202610-1')).toBe('INV-7-202610-1');
    expect(invoiceNumber(null)).toBe('');
  });

  it('numbers receipts from the payment id', () => {
    expect(receiptNumber(42)).toBe('RCT-000042');
  });

  it('builds a receipt with the balance left after the payment', () => {
    const invoice = { receipt_number: 'RCT-7-202610-1', total_amount: '31450.00', property: 'Sunrise', unit: 'B12', customer_name: 'Wanjiru Kamau' };
    const payment = { id: 42, amount: '10000.00', method: 'mpesa', reference: 'SJK4', payment_date: '2026-10-03' };
    const receipt = receiptDocument(payment, invoice, 10000);
    expect(receipt.kind).toBe('receipt');
    expect(receipt.number).toBe('RCT-000042');
    expect(receipt.balance).toBe(21450);
    expect(receipt.payment?.invoiceNumber).toBe('INV-7-202610-1');
    // Paying more than is owed leaves a credit, shown as a negative balance
    expect(receiptDocument(payment, invoice, 33450).balance).toBe(-2000);
  });
});
