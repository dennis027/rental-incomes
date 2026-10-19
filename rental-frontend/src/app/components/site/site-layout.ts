import { Component, HostListener, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from '../../services/theme';
import { SiteIcon } from './site-icon';
import { SITE } from './site-info';

/** Navigation bar and footer shared by every public page. */
@Component({
  selector: 'app-site-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SiteIcon],
  templateUrl: './site-layout.html',
})
export class SiteLayout {
  theme = inject(ThemeService);
  site = SITE;
  year = new Date().getFullYear();

  links = [
    { path: '/features', label: 'Features' },
    { path: '/pricing', label: 'Pricing' },
    { path: '/about', label: 'About' },
    { path: '/faq', label: 'FAQ' },
    { path: '/contact', label: 'Contact' },
  ];

  mobileMenuOpen = false;
  scrolled = false;
  private isBrowser: boolean;

  constructor(router: Router, @Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    // A new page starts at the top with the menu closed
    router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.mobileMenuOpen = false;
      if (this.isBrowser && !router.url.includes('#')) window.scrollTo({ top: 0 });
    });
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!this.isBrowser) return;
    this.scrolled = window.scrollY > 12;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }
}
