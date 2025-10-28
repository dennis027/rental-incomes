import { TestBed } from '@angular/core/testing';

import { MaintananceService } from './maintanance-service';

describe('MaintananceService', () => {
  let service: MaintananceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MaintananceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
