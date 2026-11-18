import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface Shortcut {
  keys: string[];
  label: string;
  /** Pressed together (Ctrl + K) rather than one after the other (G then D) */
  together?: boolean;
}

/** The keyboard shortcuts of the dashboard, opened with "?" */
@Component({
  selector: 'app-shortcuts-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-head">
      <h2 mat-dialog-title>Keyboard Shortcuts</h2>
      <button mat-icon-button mat-dialog-close aria-label="Close dialog"><mat-icon>close</mat-icon></button>
    </div>
    <mat-dialog-content>
      <dl class="shortcut-list">
        @for (shortcut of shortcuts; track shortcut.label) {
          <div class="shortcut">
            <dt>{{ shortcut.label }}</dt>
            <dd>
              @for (key of shortcut.keys; track $index; let last = $last) {
                <kbd>{{ key }}</kbd>
                @if (!last) { <span class="shortcut-then">{{ shortcut.together ? '+' : 'then' }}</span> }
              }
            </dd>
          </div>
        }
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .shortcut-list { margin: 0; display: grid; gap: 2px; }
    .shortcut { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--gray-100); }
    .shortcut:last-child { border-bottom: none; }
    dt { color: var(--gray-700); font-size: 14px; }
    dd { margin: 0; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    kbd {
      min-width: 26px;
      padding: 2px 8px;
      border: 1px solid var(--gray-200);
      border-bottom-width: 2px;
      border-radius: 6px;
      background: var(--gray-50);
      color: var(--gray-800);
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
    }
    .shortcut-then { font-size: 12px; color: var(--gray-400); }
  `,
})
export class ShortcutsDialog {
  shortcuts = inject<Shortcut[]>(MAT_DIALOG_DATA);
}

export function openShortcuts(dialog: MatDialog, shortcuts: Shortcut[]): void {
  if (!dialog.getDialogById('shortcuts')) {
    dialog.open(ShortcutsDialog, { id: 'shortcuts', data: shortcuts, width: '480px' });
  }
}
