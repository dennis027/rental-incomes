import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'theme';

/**
 * Light or dark appearance for the whole app.
 * The choice is remembered between visits; "system" (the default) follows the
 * device setting. The colours themselves live in styles.css, keyed on the
 * data-theme attribute this service puts on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(this.platformId);
  private systemDark = this.isBrowser ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined;

  /** What the user picked. */
  readonly preference = signal<ThemePreference>(this.restore());
  /** What is on screen. */
  readonly theme = signal<Theme>(this.resolve(this.preference()));

  constructor() {
    this.apply(this.theme());
    // Follow the device when it changes, as long as the user has not picked a side
    this.systemDark?.addEventListener?.('change', () => {
      if (this.preference() === 'system') {
        this.theme.set(this.resolve('system'));
        this.apply(this.theme());
      }
    });
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    this.theme.set(this.resolve(preference));
    this.apply(this.theme());
    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch {}
    }
  }

  private restore(): ThemePreference {
    if (!this.isBrowser) {
      return 'system';
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {}
    return 'system';
  }

  private resolve(preference: ThemePreference): Theme {
    if (preference !== 'system') {
      return preference;
    }
    return this.systemDark?.matches ? 'dark' : 'light';
  }

  private apply(theme: Theme): void {
    if (!this.isBrowser) {
      return;
    }
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    // Bootstrap's own dark styles follow this attribute
    root.setAttribute('data-bs-theme', theme);
  }
}
