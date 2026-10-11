import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalCustomers } from './rental-customers';
import { testProviders } from '../../../testing/test-providers';

describe('RentalCustomers', () => {
  let component: RentalCustomers;
  let fixture: ComponentFixture<RentalCustomers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalCustomers],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(RentalCustomers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
