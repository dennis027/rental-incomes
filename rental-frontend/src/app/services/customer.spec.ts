import { TestBed } from '@angular/core/testing';

import { CustomersService } from './customer';
import { testProviders } from '../testing/test-providers';

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(CustomersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
