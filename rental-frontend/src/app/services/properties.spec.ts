import { TestBed } from '@angular/core/testing';

import { PropertiesService } from './properties';
import { testProviders } from '../testing/test-providers';

describe('PropertiesService', () => {
  let service: PropertiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders });
    service = TestBed.inject(PropertiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
