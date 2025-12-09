import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UtilitymaintanaceReports } from './utilitymaintanace-reports';

describe('UtilitymaintanaceReports', () => {
  let component: UtilitymaintanaceReports;
  let fixture: ComponentFixture<UtilitymaintanaceReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UtilitymaintanaceReports]
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
