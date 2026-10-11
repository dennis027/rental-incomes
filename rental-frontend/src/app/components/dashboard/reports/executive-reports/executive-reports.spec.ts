import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutiveReports } from './executive-reports';
import { testProviders } from '../../../../testing/test-providers';

describe('ExecutiveReports', () => {
  let component: ExecutiveReports;
  let fixture: ComponentFixture<ExecutiveReports>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutiveReports],
      providers: testProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExecutiveReports);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
