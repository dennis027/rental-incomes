import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestDemoComponent } from './request-demo-component';
import { testProviders } from '../../../testing/test-providers';

describe('RequestDemoComponent', () => {
  let component: RequestDemoComponent;
  let fixture: ComponentFixture<RequestDemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestDemoComponent],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
