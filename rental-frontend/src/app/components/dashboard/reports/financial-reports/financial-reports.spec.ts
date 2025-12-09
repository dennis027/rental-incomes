import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancialReports } from './financial-reports';

describe('FinancialReports', () => {
  let component: FinancialReports;
  let fixture: ComponentFixture<FinancialReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialReports]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinancialReports);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
