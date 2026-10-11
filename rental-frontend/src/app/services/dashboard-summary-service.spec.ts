import { TestBed } from '@angular/core/testing';

import { DashboardSummaryService } from './dashboard-summary-service';
import { testProviders } from '../testing/test-providers';

describe('DashboardSummaryService', () => {
  let service: DashboardSummaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(DashboardSummaryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
