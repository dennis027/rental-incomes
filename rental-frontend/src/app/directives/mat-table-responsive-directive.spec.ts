import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { MatTableResponsiveDirective } from './mat-table-responsive-directive';
import { testProviders } from '../testing/test-providers';

// The directive reads its inputs and element through injection, so it is tested on a real table
@Component({
  imports: [MatTableResponsiveDirective],
  template: '<table appMatTableResponsive><tr><td>Cell</td></tr></table>',
})
class HostTable {}

describe('MatTableResponsiveDirective', () => {
  it('should attach to a table', () => {
    TestBed.configureTestingModule({ imports: [HostTable], providers: testProviders });
    const fixture = TestBed.createComponent(HostTable);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(MatTableResponsiveDirective));
    expect(table).toBeTruthy();
    expect(table.injector.get(MatTableResponsiveDirective).mobileBreakpoint()).toBe(768);
  });
});
