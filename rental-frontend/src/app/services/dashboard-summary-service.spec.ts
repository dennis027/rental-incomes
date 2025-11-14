import { TestBed } from '@angular/core/testing';

import { DashboardSummaryService } from './dashboard-summary-service';

describe('DashboardSummaryService', () => {
  let service: DashboardSummaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DashboardSummaryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
