/**
 * Saves rows as a CSV file the browser downloads. Excel and Google Sheets
 * open it directly; the byte-order mark keeps names like "Wanjirũ" intact in Excel.
 */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers, ...rows].map(row => row.map(csvCell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  // Firefox only downloads from a link that is in the page, and revoking the
  // URL in the same task can cancel the download before it has started
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

// A cell starting with one of these is run as a formula by Excel and Sheets
const FORMULA_START = /^[=+\-@\t\r]/;
// ...except plain numbers such as -1500.00, which must stay numbers
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * One quoted CSV cell. Text that would start a formula (a tenant named
 * '=HYPERLINK(...)', say) gets a leading apostrophe, so it is shown as text.
 */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** Today as 2026-10-21, for file names */
export function fileDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
