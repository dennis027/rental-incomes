import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantscustomersReports } from './tenantscustomers-reports';

describe('TenantscustomersReports', () => {
  let component: TenantscustomersReports;
  let fixture: ComponentFixture<TenantscustomersReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantscustomersReports]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantscustomersReports);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
