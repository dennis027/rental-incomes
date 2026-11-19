import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';

const COUNTDOWN_SECONDS = 60;

export interface IdleDialogData {
  /** False as soon as any tab has seen activity again; the activity time is shared through localStorage */
  stillIdle: () => boolean;
}

/**
 * "Are you still there?" Closes with true to stay signed in, false when time
 * ran out. Every open tab shows one; answering in any tab records activity,
 * which closes the others as "stay" instead of letting them sign everyone out.
 */
@Component({
  selector: 'app-idle-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-head">
      <h2 mat-dialog-title>Are You Still There?</h2>
    </div>
    <mat-dialog-content>
      <div class="dialog-confirm">
        <span class="dialog-confirm-icon idle-icon"><mat-icon>lock_clock</mat-icon></span>
        <p>For your tenants' privacy, KodiDesk signs you out after a period without activity.
          You will be signed out in <strong>{{ seconds }} second{{ seconds === 1 ? '' : 's' }}</strong>.</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Sign out now</button>
      <button mat-flat-button color="primary" (click)="ref.close(true)" cdkFocusInitial>Stay signed in</button>
    </mat-dialog-actions>
  `,
  styles: `.idle-icon { background: var(--brand-50); color: var(--brand-500); }`,
})
export class IdleDialog implements OnInit, OnDestroy {
  ref = inject(MatDialogRef<IdleDialog>);
  private data = inject<IdleDialogData>(MAT_DIALOG_DATA);
  private cdr = inject(ChangeDetectorRef);
  seconds = COUNTDOWN_SECONDS;
  private timer?: ReturnType<typeof setInterval>;

  /** Another tab wrote the activity time: close at once if the user is back */
  @HostListener('window:storage')
  checkOtherTabs(): void {
    if (!this.data.stillIdle()) {
      this.ref.close(true);
    }
  }

  ngOnInit(): void {
    this.timer = setInterval(() => {
      // Checked before counting down, so a tab never signs out after another said "stay"
      if (!this.data.stillIdle()) {
        this.ref.close(true);
        return;
      }
      this.seconds--;
      if (this.seconds <= 0) {
        this.ref.close(false);
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}

export function openIdleDialog(dialog: MatDialog, data: IdleDialogData): Observable<boolean | undefined> {
  return dialog.open(IdleDialog, { id: 'idle', disableClose: true, width: '440px', data }).afterClosed();
}
