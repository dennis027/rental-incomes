/**
 * Saves rows as a CSV file the browser downloads. Excel and Google Sheets
 * open it directly; the byte-order mark keeps names like "Wanjirũ" intact in Excel.
 */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [headers, ...rows].map(row => row.map(cell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Today as 2026-10-21, for file names */
export function fileDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
