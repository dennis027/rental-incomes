import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Properties } from './properties';
import { testProviders } from '../../../testing/test-providers';

describe('Properties', () => {
  let component: Properties;
  let fixture: ComponentFixture<Properties>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Properties],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(Properties);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
