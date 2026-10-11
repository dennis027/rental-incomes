import { TestBed } from '@angular/core/testing';

import { UnitsService } from './units';
import { testProviders } from '../testing/test-providers';

describe('UnitsService', () => {
  let service: UnitsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(UnitsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
