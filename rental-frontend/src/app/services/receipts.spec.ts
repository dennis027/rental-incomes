import { TestBed } from '@angular/core/testing';

import { ReceiptService } from './receipts';
import { testProviders } from '../testing/test-providers';

describe('ReceiptService', () => {
  let service: ReceiptService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(ReceiptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
