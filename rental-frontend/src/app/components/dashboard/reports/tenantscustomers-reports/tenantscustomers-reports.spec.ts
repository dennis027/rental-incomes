import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantscustomersReports } from './tenantscustomers-reports';
import { testProviders } from '../../../../testing/test-providers';

describe('TenantscustomersReports', () => {
  let component: TenantscustomersReports;
  let fixture: ComponentFixture<TenantscustomersReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantscustomersReports],
      providers: testProviders
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
