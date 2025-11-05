import { TestBed } from '@angular/core/testing';

import { SystemParametersServices } from './system-parameters-services';

describe('SystemParametersServices', () => {
  let service: SystemParametersServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SystemParametersServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
