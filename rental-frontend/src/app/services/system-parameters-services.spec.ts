import { TestBed } from '@angular/core/testing';

import { SystemParametersServices } from './system-parameters-services';
import { testProviders } from '../testing/test-providers';

describe('SystemParametersServices', () => {
  let service: SystemParametersServices;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(SystemParametersServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
