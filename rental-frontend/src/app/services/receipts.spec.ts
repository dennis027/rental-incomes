import { TestBed } from '@angular/core/testing';

import { Receipts } from './receipts';

describe('Receipts', () => {
  let service: Receipts;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Receipts);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
