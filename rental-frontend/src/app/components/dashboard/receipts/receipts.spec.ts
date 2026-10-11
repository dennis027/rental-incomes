import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Receipts } from './receipts';
import { testProviders } from '../../../testing/test-providers';

describe('Receipts', () => {
  let component: Receipts;
  let fixture: ComponentFixture<Receipts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Receipts],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(Receipts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
