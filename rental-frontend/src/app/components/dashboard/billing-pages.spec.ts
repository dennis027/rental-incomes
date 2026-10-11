import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { testProviders } from '../../testing/test-providers';
import { Arrears } from './arrears/arrears';
import { TenantStatement } from './tenant-statement/tenant-statement';
import { ContractsEndingSoon } from './contracts-ending-soon/contracts-ending-soon';
import { PaybillInbox } from './paybill-inbox/paybill-inbox';
import { MoveOutDialog } from './move-out/move-out-dialog';
import { RecordPaymentDialog } from './record-payment/record-payment-dialog';

const dialogRef = { close: jasmine.createSpy('close'), updateSize: jasmine.createSpy('updateSize') };

function setup(data: any = {}) {
  TestBed.configureTestingModule({
    providers: [
      ...testProviders,
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('billing pages', () => {
  it('create without errors', () => {
    setup({ contractId: 1 });
    for (const page of [Arrears, TenantStatement, ContractsEndingSoon, PaybillInbox, MoveOutDialog] as any[]) {
      const fixture = TestBed.createComponent(page);
      fixture.detectChanges();
      expect(fixture.componentInstance).toBeTruthy();
    }
  });

  it('Arrears lists what the server returns and filters to overdue tenants', () => {
    const http = setup();
    const fixture = TestBed.createComponent(Arrears);
    fixture.detectChanges();
    const row = (name: string, days: number) => ({ customer_name: name, unit: 'A1', customer_phone: '0712345678', days_overdue: days, outstanding: '1000.00' });
    http.expectOne(request => request.url.endsWith('api/arrears/')).flush({
      summary: { tenants: 2, total_outstanding: 2000, overdue_tenants: 1, total_overdue: 1000 },
      rows: [row('Amina Hassan', 12), row('Brian Otieno', 0)],
    });
    const page = fixture.componentInstance;
    expect(page.dataSource.data.length).toBe(2);
    expect(page.overdueCount).toBe(1);
    page.setFilter('overdue');
    expect(page.dataSource.data.map(r => r.customer_name)).toEqual(['Amina Hassan']);
    page.setFilter('all');
    page.search = 'brian';
    page.applyFilter();
    expect(page.dataSource.data.map(r => r.customer_name)).toEqual(['Brian Otieno']);
  });
});

describe('RecordPaymentDialog', () => {
  it('starts from the full balance and shows what a payment leaves', () => {
    setup({ invoiceId: 7, tenant: 'Wanjiru Kamau', unit: 'B12', owes: 15000 });
    const fixture = TestBed.createComponent(RecordPaymentDialog);
    fixture.detectChanges();
    const dialog = fixture.componentInstance;
    expect(dialog.form.value.amount).toBe(15000);
    expect(dialog.remaining).toBe(0);
    dialog.form.patchValue({ amount: 5000 });
    expect(dialog.remaining).toBe(10000);
    dialog.form.patchValue({ amount: 17000 });
    expect(dialog.remaining).toBe(-2000);
  });

  it('sends an empty reference as none and the payment to the chosen invoice', () => {
    const http = setup({ invoiceId: 7, tenant: 'Wanjiru Kamau', unit: 'B12', owes: 15000 });
    const fixture = TestBed.createComponent(RecordPaymentDialog);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ method: 'cash', reference: '  ' });
    fixture.componentInstance.save();
    const request = http.expectOne(r => r.method === 'POST' && r.url.endsWith('api/payments/'));
    expect(request.request.body).toEqual(jasmine.objectContaining({ receipt: 7, amount: 15000, method: 'cash', reference: null }));
  });

  it('lists tenants who owe when no invoice is given', () => {
    const http = setup({ propertyId: 3 });
    const fixture = TestBed.createComponent(RecordPaymentDialog);
    fixture.detectChanges();
    const request = http.expectOne(r => r.url.endsWith('api/arrears/'));
    expect(request.request.params.get('property_id')).toBe('3');
    request.flush({ rows: [{ contract_id: 5, invoice_id: 9, customer_name: 'Amina Hassan', unit: 'A3', outstanding: '8000.00' }] });
    const dialog = fixture.componentInstance;
    dialog.onTenantChange(5);
    expect(dialog.invoiceId).toBe(9);
    expect(dialog.form.value.amount).toBe(8000);
  });
});
