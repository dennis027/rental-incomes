import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Units } from './units';
import { testProviders } from '../../../testing/test-providers';

describe('Units', () => {
  let component: Units;
  let fixture: ComponentFixture<Units>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Units],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(Units);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
