import { ChangeDetectorRef, Component, OnInit, PLATFORM_ID, TemplateRef, ViewChild, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { SharedImports } from '../../../shared-imports/imports';
import { DialogSize } from '../../../shared/dialog-sizes';
import { AccountService, AccountSettings, ROLE_OPTIONS, Role, TeamMember, currentRole } from '../../../services/account';

/** Who can sign in to the account, what each person may do, and account-wide settings */
@Component({
  selector: 'app-team',
  imports: [SharedImports],
  templateUrl: './team.html',
  styleUrl: './team.css'
})
export class Team implements OnInit {
  @ViewChild('addMemberDialog') addMemberDialog!: TemplateRef<any>;
  @ViewChild('removeMemberDialog') removeMemberDialog!: TemplateRef<any>;

  private accountService = inject(AccountService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);

  roles = ROLE_OPTIONS;
  isOwner = currentRole() === 'owner';
  myUsername = '';

  loading = true;
  failed = false;
  saving = false;
  account: AccountSettings | null = null;
  members: TeamMember[] = [];
  removing: TeamMember | null = null;

  memberForm = this.fb.group({
    first_name: [''],
    last_name: [''],
    username: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['caretaker' as Role, Validators.required],
  });

  accountForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    sms_reminders_enabled: [false],
    sms_days_before_due: [3, [Validators.required, Validators.min(0), Validators.max(15)]],
    sms_overdue_every_days: [7, [Validators.required, Validators.min(1), Validators.max(30)]],
  });

  mpesaForm = this.fb.group({
    mpesa_shortcode: ['', [Validators.pattern(/^\d{5,7}$/)]],
    // Never sent back by the server; left blank keeps the saved one
    mpesa_passkey: [''],
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.myUsername = localStorage.getItem('user_name') || '';
      this.load();
    }
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    forkJoin({ account: this.accountService.account(), team: this.accountService.team() }).subscribe({
      next: ({ account, team }) => {
        this.account = account;
        this.members = team;
        this.accountForm.patchValue(account, { emitEvent: false });
        this.mpesaForm.reset({ mpesa_shortcode: account.mpesa_shortcode, mpesa_passkey: '' }, { emitEvent: false });
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.failed = true;
        this.cdr.markForCheck();
      }
    });
  }

  get activeMembers(): TeamMember[] {
    return this.members.filter(member => member.is_active);
  }

  roleHint(value: Role | null | undefined): string {
    return this.roles.find(role => role.value === value)?.hint ?? '';
  }

  displayName(member: TeamMember): string {
    return [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username;
  }

  initials(member: TeamMember): string {
    return this.displayName(member).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  saveAccount(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }
    this.accountService.updateAccount(this.accountForm.getRawValue() as Partial<AccountSettings>).subscribe({
      next: account => {
        this.account = account;
        localStorage.setItem('account_name', account.name);
        this.notify('Saved');
      },
      error: err => this.notify(this.firstError(err) || 'The changes could not be saved.')
    });
  }

  saveMpesa(): void {
    if (this.mpesaForm.invalid) {
      this.mpesaForm.markAllAsTouched();
      return;
    }
    const { mpesa_shortcode, mpesa_passkey } = this.mpesaForm.getRawValue();
    const changes: Partial<AccountSettings> = { mpesa_shortcode: (mpesa_shortcode || '').trim() };
    if (mpesa_passkey) {
      changes.mpesa_passkey = mpesa_passkey;
    }
    this.accountService.updateAccount(changes).subscribe({
      next: account => {
        this.account = account;
        this.mpesaForm.reset({ mpesa_shortcode: account.mpesa_shortcode, mpesa_passkey: '' });
        this.notify('Saved');
        this.cdr.markForCheck();
      },
      error: err => this.notify(this.firstError(err) || 'The changes could not be saved.')
    });
  }

  copy(text: string | null): void {
    if (!text) {
      return;
    }
    navigator.clipboard?.writeText(text).then(() => this.notify('Copied'));
  }

  openAddMember(): void {
    this.memberForm.reset({ first_name: '', last_name: '', username: '', email: '', role: 'caretaker' });
    this.dialog.open(this.addMemberDialog);
  }

  addMember(): void {
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.accountService.addMember(this.memberForm.getRawValue() as any).subscribe({
      next: member => {
        this.saving = false;
        // Someone removed earlier comes back as the same member
        this.members = [...this.members.filter(existing => existing.id !== member.id), member];
        this.dialog.closeAll();
        this.notify(`${this.displayName(member)} added. They have been emailed how to sign in.`);
      },
      error: err => {
        this.saving = false;
        this.notify(this.firstError(err) || 'The member could not be added.');
        this.cdr.markForCheck();
      }
    });
  }

  changeRole(member: TeamMember, role: Role): void {
    const previous = member.role;
    this.accountService.changeRole(member.id, role).subscribe({
      next: updated => {
        this.members = this.members.map(m => (m.id === updated.id ? updated : m));
        this.notify(`${this.displayName(updated)} is now ${updated.role_label.toLowerCase()}`);
      },
      error: err => {
        // Put the select back to what the server still has
        this.members = this.members.map(m => (m.id === member.id ? { ...m, role: previous } : m));
        this.notify(this.firstError(err) || 'The role could not be changed.');
      }
    });
  }

  confirmRemove(member: TeamMember): void {
    this.removing = member;
    this.dialog.open(this.removeMemberDialog, DialogSize.confirm);
  }

  removeMember(): void {
    const member = this.removing;
    if (!member) {
      return;
    }
    this.accountService.removeMember(member.id).subscribe({
      next: () => {
        this.members = this.members.map(m => (m.id === member.id ? { ...m, is_active: false } : m));
        this.dialog.closeAll();
        this.notify(`${this.displayName(member)} can no longer sign in`);
      },
      error: err => this.notify(this.firstError(err) || 'The member could not be removed.')
    });
  }

  private firstError(err: any): string {
    const body = err?.error;
    if (!body || typeof body !== 'object') {
      return '';
    }
    if (body.error || body.detail) {
      return body.error || body.detail;
    }
    const first = Object.values(body)[0];
    return Array.isArray(first) ? String(first[0]) : '';
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 4000 });
    this.cdr.markForCheck();
  }
}
