import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalCustomers } from './rental-customers';

describe('RentalCustomers', () => {
  let component: RentalCustomers;
  let fixture: ComponentFixture<RentalCustomers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalCustomers]
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
