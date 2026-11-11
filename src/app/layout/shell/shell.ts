import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { isOrganizer } from '../../core/auth/permissions';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mobileOpen = signal(false);
  protected readonly pageTitle = signal('');

  constructor() {
    this.updateTitle();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.mobileOpen.set(false);
        this.updateTitle();
      });

    this.auth.loadProfile().subscribe({
      next: (user) => {
        if (!isOrganizer(user) && this.router.url !== '/tanpa-akses') {
          this.router.navigate(['/tanpa-akses']);
        }
      },
      error: () => undefined,
    });
  }

  private updateTitle(): void {
    let snapshot = this.route.snapshot.firstChild;
    while (snapshot?.firstChild) {
      snapshot = snapshot.firstChild;
    }
    this.pageTitle.set(snapshot?.title ?? '');
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/masuk']);
  }
}
