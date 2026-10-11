import { TestBed } from '@angular/core/testing';

import { AuthInterceptor } from './auth-interceptor';
import { testProviders } from '../testing/test-providers';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AuthInterceptor, ...testProviders] });
    interceptor = TestBed.inject(AuthInterceptor);
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });
});
