import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OccupancyReports } from './occupancy-reports';
import { testProviders } from '../../../../testing/test-providers';

describe('OccupancyReports', () => {
  let component: OccupancyReports;
  let fixture: ComponentFixture<OccupancyReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OccupancyReports],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(OccupancyReports);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
