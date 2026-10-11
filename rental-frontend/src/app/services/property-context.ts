import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PropertiesService } from './properties';

const STORAGE_KEY = 'selected_property_id';

/**
 * The property the user is working in.
 * It is chosen once in the top bar, remembered between visits, and every
 * dashboard page follows it instead of having its own property picker.
 */
@Injectable({ providedIn: 'root' })
export class PropertyContext {
  private platformId = inject(PLATFORM_ID);
  private propertiesService = inject(PropertiesService);

  readonly properties = signal<any[]>([]);
  readonly selectedId = signal<number | null>(this.restore());
  readonly selected = computed(() => this.properties().find(property => property.id === this.selectedId()) ?? null);

  /** Fetch the property list for the switcher. */
  load(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.propertiesService.getProperties().subscribe({
      next: properties => this.setProperties(properties),
      error: () => {}
    });
  }

  /** Use a list a page has already fetched, e.g. after a property was added or removed. */
  setProperties(properties: any[]): void {
    this.properties.set(Array.isArray(properties) ? properties : []);
    this.resolve(this.properties());
  }

  /**
   * The property a page should show: the remembered one when it is still in
   * the list, otherwise the first property.
   */
  resolve(properties: any[]): number | null {
    if (!properties || properties.length === 0) {
      return this.selectedId();
    }
    const current = this.selectedId();
    if (current !== null && properties.some(property => property.id === current)) {
      return current;
    }
    this.select(properties[0].id);
    return properties[0].id;
  }

  select(id: number): void {
    this.selectedId.set(id);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  }

  private restore(): number | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  }
}
