import { TestBed } from '@angular/core/testing';

import { MaintenanceService } from './maintanance-service';
import { testProviders } from '../testing/test-providers';

describe('MaintenanceService', () => {
  let service: MaintenanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(MaintenanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
