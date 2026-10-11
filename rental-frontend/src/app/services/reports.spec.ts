import { TestBed } from '@angular/core/testing';

import { ReportsService } from './reports';
import { testProviders } from '../testing/test-providers';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(ReportsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
