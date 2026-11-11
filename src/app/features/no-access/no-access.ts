import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { initials } from '../../core/util/format';

@Component({
  selector: 'app-no-access',
  imports: [LucideAngularModule],
  templateUrl: './no-access.html',
})
export class NoAccessPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly initials = initials;

  protected switchAccount(): void {
    this.auth.logout();
    this.router.navigate(['/masuk']);
  }
}
