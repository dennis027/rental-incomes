import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Payments } from './payments';
import { testProviders } from '../../../testing/test-providers';

describe('Payments', () => {
  let component: Payments;
  let fixture: ComponentFixture<Payments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(Payments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
