import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashHome } from './dash-home';

describe('DashHome', () => {
  let component: DashHome;
  let fixture: ComponentFixture<DashHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
