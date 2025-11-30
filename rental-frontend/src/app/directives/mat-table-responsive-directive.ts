import {
  Directive,
  ElementRef,
  OnInit,
  OnDestroy,
  input,
  effect,
  Renderer2,
  inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appMatTableResponsive]',
  standalone: true
})
export class MatTableResponsiveDirective implements OnInit, OnDestroy {
  // Angular 20 signal inputs
  mobileBreakpoint = input<number>(768);
  tabletBreakpoint = input<number>(1024);

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private platformId = inject(PLATFORM_ID);

  private resizeObserver?: ResizeObserver;
  private isBrowser = false;

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Signal effect (runs only on browser)
    effect(() => {
      if (!this.isBrowser) return;
      this.checkWidth();
    });
  }

  ngOnInit() {
    if (!this.isBrowser) return; // ⛔ Do not run on SSR

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

    // Create wrapper div
    const wrapper = this.renderer.createElement('div');
    this.renderer.addClass(wrapper, 'responsive-table-wrapper');

    const parent = this.renderer.parentNode(table);

    // Insert wrapper in DOM and move table inside
    this.renderer.insertBefore(parent, wrapper, table);
    this.renderer.appendChild(wrapper, table);

    this.checkWidth();
  }

  private observeResize() {
    // Observe the wrapper instead of the table — more stable
    const wrapper = this.el.nativeElement.parentNode;

    this.resizeObserver = new ResizeObserver(() => {
      this.checkWidth();
    });

    this.resizeObserver.observe(wrapper);
  }

  private checkWidth() {
    if (!this.isBrowser) return; // SSR protection

    const width = window.innerWidth;
    const table = this.el.nativeElement;

    // Remove old classes
    this.renderer.removeClass(table, 'mobile-view');
    this.renderer.removeClass(table, 'tablet-view');
    this.renderer.removeClass(table, 'desktop-view');

    // Apply correct class
    if (width < this.mobileBreakpoint()) {
      this.renderer.addClass(table, 'mobile-view');
    } else if (width < this.tabletBreakpoint()) {
      this.renderer.addClass(table, 'tablet-view');
    } else {
      this.renderer.addClass(table, 'desktop-view');
    }
  }
}
   