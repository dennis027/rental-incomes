import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Expensemaintanace } from './expensemaintanace';

describe('Expensemaintanace', () => {
  let component: Expensemaintanace;
  let fixture: ComponentFixture<Expensemaintanace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Expensemaintanace]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Expensemaintanace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
