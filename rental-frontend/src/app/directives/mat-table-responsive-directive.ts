import { Directive, ElementRef, OnInit, OnDestroy, input, effect, Renderer2, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

@Directive({
  selector: '[appMatTableResponsive]', // Changed selector to match usage
  standalone: true
})
export class MatTableResponsiveDirective implements OnInit, OnDestroy {
  // New Angular 20 signal inputs
  mobileBreakpoint = input<number>(768);
  tabletBreakpoint = input<number>(1024);
  
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private resizeObserver?: ResizeObserver;

  constructor() {
    // React to breakpoint changes with effects
    effect(() => {
      const mobile = this.mobileBreakpoint();
      const tablet = this.tabletBreakpoint();
      this.checkWidth();
    });
  }

  ngOnInit() {
    this.setupResponsive();
    this.observeResize();
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private setupResponsive() {
    const table = this.el.nativeElement;
    
    // Add responsive wrapper
    const wrapper = this.renderer.createElement('div');
    this.renderer.addClass(wrapper, 'responsive-table-wrapper');
    
    const parent = this.renderer.parentNode(table);
    this.renderer.insertBefore(parent, wrapper, table);
    this.renderer.appendChild(wrapper, table);
    
    this.checkWidth();
  }

  private observeResize() {
    this.resizeObserver = new ResizeObserver(() => {
      this.checkWidth();
    });
    
    this.resizeObserver.observe(this.el.nativeElement);
  }

  private checkWidth() {
    const width = window.innerWidth;
    const table = this.el.nativeElement;
    
    // Remove existing responsive classes
    this.renderer.removeClass(table, 'mobile-view');
    this.renderer.removeClass(table, 'tablet-view');
    this.renderer.removeClass(table, 'desktop-view');
    
    // Add appropriate class based on width
    if (width < this.mobileBreakpoint()) {
      this.renderer.addClass(table, 'mobile-view');
    } else if (width < this.tabletBreakpoint()) {
      this.renderer.addClass(table, 'tablet-view');
    } else {
      this.renderer.addClass(table, 'desktop-view');
    }
  }
}