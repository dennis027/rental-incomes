import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OccupancyReports } from './occupancy-reports';

describe('OccupancyReports', () => {
  let component: OccupancyReports;
  let fixture: ComponentFixture<OccupancyReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OccupancyReports]
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
