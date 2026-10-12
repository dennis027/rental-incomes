import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Light or dark appearance for the whole app.
 * The choice is remembered between visits; until the user picks one, the
 * device setting decides. The colours themselves live in styles.css, keyed
 * on the data-theme attribute this service puts on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.restore());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    this.apply(theme);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {}
    }
  }

  private restore(): Theme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'light';
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private apply(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    // Bootstrap's own dark styles follow this attribute
    root.setAttribute('data-bs-theme', theme);
  }
}
