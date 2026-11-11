import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { PERMISSIONS, permissionLabel } from '../../core/auth/permissions';
import { ApiError } from '../../core/models/api-error.model';
import { Profile } from '../../core/models/auth.model';
import { USER_STATUS_LABEL, UserStatus } from '../../core/models/user.model';
import { errorMessage } from '../../core/util/errors';
import { initials } from '../../core/util/format';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, LucideAngularModule, ErrorState, StatusBadge],
  templateUrl: './account.html',
})
export class AccountPage {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  protected readonly profile = signal<Profile | null>(this.auth.user());
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly showNewPassword = signal(false);

  protected readonly form = this.fb.group(
    {
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, passwordValidator]],
      confirm_password: ['', [Validators.required]],
    },
    { validators: [confirmPasswordValidator] },
  );

  constructor() {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.auth.loadProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected submitPassword(): void {
    if (this.saving()) {
      return;
    }
    this.error.set(null);
    this.notice.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Periksa kembali kata sandi yang diisi.');
      return;
    }

    this.saving.set(true);
    this.auth
      .changePassword({
        current_password: this.form.controls.current_password.value,
        new_password: this.form.controls.new_password.value,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.reset();
          this.notice.set('Kata sandi berhasil diperbarui.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            error instanceof ApiError && error.status === 401
              ? 'Kata sandi saat ini salah.'
              : errorMessage(error),
          );
        },
      });
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/masuk']);
  }

  protected statusLabel(status: string): string {
    return USER_STATUS_LABEL[status as UserStatus] ?? status;
  }

  protected readonly permissionLabel = permissionLabel;
  protected readonly initials = initials;
  protected readonly permissions = Object.values(PERMISSIONS);
}

function passwordValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) {
    return null;
  }
  if (value.length < 8) {
    return { minlength: { requiredLength: 8 } };
  }
  if (value.length > 72) {
    return { maxlength: { requiredLength: 72 } };
  }
  return /[A-Za-z]/.test(value) && /\d/.test(value) ? null : { weak: true };
}

function confirmPasswordValidator(group: AbstractControl): ValidationErrors | null {
  const next = group.get('new_password')?.value;
  const confirm = group.get('confirm_password')?.value;
  return next === confirm ? null : { mismatch: true };
}
