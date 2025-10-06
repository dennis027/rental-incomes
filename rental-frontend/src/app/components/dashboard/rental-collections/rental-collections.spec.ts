import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentalCollections } from './rental-collections';

describe('RentalCollections', () => {
  let component: RentalCollections;
  let fixture: ComponentFixture<RentalCollections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentalCollections]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RentalCollections);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
