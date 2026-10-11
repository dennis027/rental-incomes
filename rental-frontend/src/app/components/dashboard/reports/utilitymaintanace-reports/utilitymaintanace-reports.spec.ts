import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UtilitymaintanaceReports } from './utilitymaintanace-reports';
import { testProviders } from '../../../../testing/test-providers';

describe('UtilitymaintanaceReports', () => {
  let component: UtilitymaintanaceReports;
  let fixture: ComponentFixture<UtilitymaintanaceReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UtilitymaintanaceReports],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(UtilitymaintanaceReports);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
