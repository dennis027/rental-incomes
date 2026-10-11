import { TestBed } from '@angular/core/testing';

import { ExpensesService } from './expense-service';
import { testProviders } from '../testing/test-providers';

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(ExpensesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
