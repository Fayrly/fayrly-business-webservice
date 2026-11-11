import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { filter } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { PERMISSIONS } from '../../core/auth/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  permissions?: string[];
  prefix?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Ringkasan', href: '/ringkasan', icon: 'layout-dashboard' },
  {
    label: 'Event Saya',
    href: '/events',
    icon: 'calendar-days',
    permissions: [PERMISSIONS.eventRead],
    prefix: true,
  },
  {
    label: 'Jadwal',
    href: '/jadwal',
    icon: 'calendar-clock',
    permissions: [PERMISSIONS.eventRead],
  },
  {
    label: 'Harga & Promo',
    href: '/harga',
    icon: 'ticket',
    permissions: [PERMISSIONS.eventRead],
  },
  {
    label: 'Ulasan',
    href: '/ulasan',
    icon: 'star',
    permissions: [PERMISSIONS.eventRead],
  },
  {
    label: 'Laporan',
    href: '/laporan',
    icon: 'file-text',
    permissions: [PERMISSIONS.reportRead],
  },
  { label: 'Akun', href: '/akun', icon: 'user-round' },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mobileOpen = input(false);
  readonly closeMobile = output<void>();
  readonly logout = output<void>();

  protected readonly currentUrl = signal(this.router.url);
  protected readonly items = computed(() =>
    NAV_ITEMS.filter(
      (item) => !item.permissions || this.auth.hasAny(item.permissions),
    ),
  );
  protected readonly user = this.auth.user;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }

  protected isActive(item: NavItem): boolean {
    const url = this.currentUrl().split('?')[0];
    return item.prefix ? url === item.href || url.startsWith(`${item.href}/`) : url === item.href;
  }
}
