import { TestBed } from '@angular/core/testing';

import { ContractsService } from './contract-service';
import { testProviders } from '../testing/test-providers';

describe('ContractsService', () => {
  let service: ContractsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(ContractsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
