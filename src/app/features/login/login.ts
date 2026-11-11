import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { ApiError } from '../../core/models/api-error.model';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, LucideAngularModule],
  templateUrl: './login.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly remember = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fieldErrors = signal<string[]>([]);
  private readonly returnUrl = this.sanitizeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.loading()) {
      return;
    }

    this.error.set(null);
    this.fieldErrors.set([]);

    const email = this.email().trim();
    if (!email || !this.password()) {
      this.error.set('Email dan kata sandi wajib diisi.');
      return;
    }

    this.loading.set(true);
    this.auth
      .login({ email, password: this.password() }, this.remember())
      .pipe(switchMap(() => this.auth.loadProfile()))
      .subscribe({
        next: () => {
          this.router.navigateByUrl(this.returnUrl || '/ringkasan');
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if (error instanceof ApiError) {
            if (error.status === 401) {
              this.error.set('Email atau kata sandi salah.');
            } else if (error.status === 403) {
              this.error.set('Akun ini tidak aktif. Hubungi administrator.');
            } else {
              this.error.set(error.message);
            }
            this.fieldErrors.set(error.fieldMessages);
            return;
          }
          this.error.set('Tidak bisa masuk. Coba lagi.');
        },
      });
  }

  protected onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected onRememberChange(event: Event): void {
    this.remember.set((event.target as HTMLInputElement).checked);
  }

  private sanitizeReturnUrl(raw: string | null): string {
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
  }
}
