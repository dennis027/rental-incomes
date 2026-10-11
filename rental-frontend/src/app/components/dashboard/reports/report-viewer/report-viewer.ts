import { Component, Input, OnInit, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { PropertyContext } from '../../../../services/property-context';
import { isPlatformBrowser } from '@angular/common';
import { SharedImports } from '../../../../shared-imports/imports';
import { ReportsService } from '../../../../services/reports';
import { PropertiesService } from '../../../../services/properties';
import { CustomersService } from '../../../../services/customer';
import { ReportDefinition } from './report-definitions';

interface StatGroup {
  title: string;
  stats: { label: string; value: string }[];
}

interface ReportTable {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
  expanded: boolean;
}

const ROW_LIMIT = 25;

// Words that mark a number as money or as a percentage
const MONEY = /(amount|revenue|rent|balance|expense|outstanding|profit|cost|deposit|income|collected|arrears|forecast|paid|price|total_due|^\d.*_days$|grand_total|charge|bill)/;
const NOT_MONEY = /(count|units|days_|_days_|tenants|contracts|months|rate|percentage|id$|number|consumed|reading|occupied|vacant|requests|properties)/;
const PERCENT = /(rate|percentage|margin|efficiency)/;

/**
 * Shows any report from the reports API: pick a report, set its filters, and the
 * response is laid out as summary figures and tables.
 */
@Component({
  selector: 'app-report-viewer',
  imports: [SharedImports],
  templateUrl: './report-viewer.html',
  styleUrl: './report-viewer.css'
})
export class ReportViewer implements OnInit {
  @Input() reports: ReportDefinition[] = [];

  private reportsService = inject(ReportsService);
  private propertiesService = inject(PropertiesService);
  private customersService = inject(CustomersService);
  private platformId = inject(PLATFORM_ID);

  // Reports open on the property chosen in the top bar; "All properties" can still be picked here
  private propertyContext = inject(PropertyContext);
  private propertySync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => {
      const value = propertyId === null ? '' : String(propertyId);
      if (this.selected() && this.propertyId !== value) {
        this.propertyId = value;
        this.run();
      }
    });
  });

  selected = signal<ReportDefinition | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  period = signal<string | null>(null);
  statGroups = signal<StatGroup[]>([]);
  tables = signal<ReportTable[]>([]);
  hasRun = signal(false);

  properties = signal<any[]>([]);
  tenants = signal<any[]>([]);

  // Filter values, shared between reports so a chosen property or date range sticks
  propertyId = '';
  tenantId = '';
  startDate: Date | null = null;
  endDate: Date | null = null;
  extra: Record<string, any> = {};

  readonly rowLimit = ROW_LIMIT;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.propertiesService.getProperties().subscribe({
      next: res => this.properties.set(this.asList(res)),
      error: () => this.properties.set([])
    });

    if (this.reports.some(report => report.tenant)) {
      this.customersService.getCustomers().subscribe({
        next: res => this.tenants.set(this.asList(res)),
        error: () => this.tenants.set([])
      });
    }

    const chosen = this.propertyContext.selectedId();
    this.propertyId = chosen === null ? '' : String(chosen);

    if (this.reports.length > 0) {
      this.select(this.reports[0]);
    }
  }

  select(report: ReportDefinition): void {
    this.selected.set(report);
    this.extra = {};
    this.run();
  }

  run(): void {
    const report = this.selected();
    if (!report) {
      return;
    }

    this.error.set(null);

    // A tenant report cannot run until a tenant is chosen
    if (report.tenant && !this.tenantId) {
      this.clearResult();
      this.hasRun.set(false);
      return;
    }

    const filters: Record<string, any> = { ...this.extra };
    if (report.property) {
      filters['property_id'] = this.propertyId;
    }
    if (report.dates) {
      filters['start_date'] = this.toIsoDate(this.startDate);
      filters['end_date'] = this.toIsoDate(this.endDate);
    }

    this.loading.set(true);
    this.reportsService.getReport(report.path.replace('{tenant}', this.tenantId), filters).subscribe({
      next: res => {
        this.render(res);
        this.hasRun.set(true);
        this.loading.set(false);
      },
      error: err => {
        this.clearResult();
        this.hasRun.set(false);
        this.loading.set(false);
        // A 401 is handled by the session interceptor
        if (err.status !== 401) {
          this.error.set(err.error?.error || err.error?.detail || 'This report could not be loaded. Please try again.');
        }
      }
    });
  }

  resetFilters(): void {
    this.propertyId = '';
    this.startDate = null;
    this.endDate = null;
    this.extra = {};
    this.run();
  }

  visibleRows(table: ReportTable): Record<string, any>[] {
    return table.expanded ? table.rows : table.rows.slice(0, ROW_LIMIT);
  }

  toggleRows(table: ReportTable): void {
    table.expanded = !table.expanded;
    this.tables.update(tables => [...tables]);
  }

  format(key: string, value: any): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      const name = key.toLowerCase();
      // Identifiers and years are shown as they are, without thousands separators
      if (/(^|_)(id|year)$/.test(name)) {
        return String(value);
      }
      if (PERCENT.test(name)) {
        return `${this.round(value)}%`;
      }
      if (MONEY.test(name) && !NOT_MONEY.test(name)) {
        return `KSh ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return this.round(value).toLocaleString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return this.formatDate(key, String(value)) ?? String(value);
  }

  /**
   * Dates arrive as 2026-10-01 or 2026-10-01T00:00:00+03:00. They are shown as
   * 1 Oct 2026, with the time only when there is one, and month totals as
   * October 2026. Returns null for text that is not a date.
   */
  private formatDate(key: string, value: string): string | null {
    const monthOnly = /^(\d{4})-(\d{2})$/.exec(value);
    if (monthOnly) {
      return new Date(+monthOnly[1], +monthOnly[2] - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const dateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value);
    if (!dateOnly && !dateTime) {
      return null;
    }
    // A plain date is built from its parts so the time zone cannot move it a day
    let date = dateOnly ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]) : new Date(value);
    if (isNaN(date.getTime())) {
      return null;
    }
    // Day and month totals come back as midnight UTC; that is a date, not 3 a.m. Nairobi time
    if (!dateOnly && date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
      date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
    const name = key.toLowerCase();
    if (/(^|_)month$/.test(name)) {
      return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    if (/(^|_)week$/.test(name)) {
      return `Week of ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (dateOnly || (date.getHours() === 0 && date.getMinutes() === 0)) {
      return day;
    }
    return `${day}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }

  private formatRange(start: any, end: any): string {
    const show = (value: any) => (value ? this.formatDate('date', String(value)) ?? String(value) : '');
    return `${show(start)} to ${show(end)}`;
  }

  exportCsv(table: ReportTable): void {
    const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      table.columns.map(column => escape(column.label)).join(','),
      ...table.rows.map(row => table.columns.map(column => escape(row[column.key])).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.selected()?.id ?? 'report'}-${this.slug(table.title)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  tenantName(tenant: any): string {
    return `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() || `Tenant #${tenant.id}`;
  }

  /**
   * Turn a report response into summary figures and tables.
   * Plain values and objects of plain values become figures; lists become tables.
   */
  private render(res: any): void {
    const groups: StatGroup[] = [];
    const tables: ReportTable[] = [];
    const topLevel: StatGroup = { title: 'Summary', stats: [] };

    this.period.set(null);

    // Some reports give the date range as plain fields instead of a period object
    if (res?.start_date && res?.end_date) {
      this.period.set(this.formatRange(res.start_date, res.end_date));
    }

    Object.entries(res ?? {}).forEach(([key, value]) => {
      if ((key === 'start_date' || key === 'end_date') && res?.start_date && res?.end_date) {
        return;
      }
      if (key === 'period' && this.isRecord(value)) {
        const range = value as Record<string, any>;
        this.period.set(this.formatRange(range['start_date'], range['end_date']));
        return;
      }
      if (Array.isArray(value)) {
        tables.push(this.toTable(this.label(key), value));
        return;
      }
      if (this.isRecord(value)) {
        const record = value as Record<string, any>;
        const lists = Object.entries(record).filter(([, inner]) => Array.isArray(inner));
        const figures = Object.entries(record).filter(([, inner]) => !Array.isArray(inner) && !this.isRecord(inner));
        if (figures.length > 0) {
          groups.push({ title: this.label(key), stats: figures.map(([k, v]) => ({ label: this.label(k), value: this.format(k, v) })) });
        }
        lists.forEach(([k, inner]) => tables.push(this.toTable(`${this.label(key)}: ${this.label(k)}`, inner as any[])));
        return;
      }
      topLevel.stats.push({ label: this.label(key), value: this.format(key, value) });
    });

    if (topLevel.stats.length > 0) {
      groups.unshift(topLevel);
    }

    this.statGroups.set(groups);
    this.tables.set(tables);
  }

  private toTable(title: string, rows: any[]): ReportTable {
    const flatRows = rows.map(row => (this.isRecord(row) ? this.flatten(row) : { value: row }));
    const keys: string[] = [];
    flatRows.forEach(row => Object.keys(row).forEach(key => {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }));
    return { title, columns: keys.map(key => ({ key, label: this.label(key) })), rows: flatRows, expanded: false };
  }

  /** Nested objects inside a row become extra columns, e.g. units.total -> "units total" */
  private flatten(row: Record<string, any>, prefix = ''): Record<string, any> {
    const flat: Record<string, any> = {};
    Object.entries(row).forEach(([key, value]) => {
      const name = prefix ? `${prefix}_${key}` : key;
      if (this.isRecord(value)) {
        Object.assign(flat, this.flatten(value as Record<string, any>, name));
      } else if (Array.isArray(value)) {
        flat[name] = value.length;
      } else {
        flat[name] = value;
      }
    });
    return flat;
  }

  private clearResult(): void {
    this.period.set(null);
    this.statGroups.set([]);
    this.tables.set([]);
  }

  private label(key: string): string {
    const text = key.replace(/[_-]+/g, ' ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private slug(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private isRecord(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private asList(res: any): any[] {
    if (Array.isArray(res)) return res;
    const list = res?.results ?? res?.data;
    return Array.isArray(list) ? list : [];
  }

  private toIsoDate(date: Date | null): string {
    if (!date) {
      return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
