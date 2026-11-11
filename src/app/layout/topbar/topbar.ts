import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, map, of } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { ReportService } from '../../core/api/report.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { formatNumber } from '../../core/util/format';

interface AttentionItem {
  label: string;
  detail: string;
  href: string;
  queryParams?: Record<string, string>;
  action: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './topbar.html',
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventService);
  private readonly reportsApi = inject(ReportService);

  readonly pageTitle = input('');
  readonly openMobile = output<void>();

  protected readonly user = this.auth.user;
  protected readonly canWrite = this.auth.has(PERMISSIONS.eventWrite);
  protected readonly canApproveReports = this.auth.has(PERMISSIONS.reportApprove);

  protected readonly searchTerm = signal('');
  protected readonly bellLoading = signal(false);
  protected readonly bellLoaded = signal(false);
  protected readonly attention = signal<AttentionItem[]>([]);

  protected readonly hasAttention = computed(() => this.attention().length > 0);

  protected initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    const q = this.searchTerm().trim();
    this.router.navigate(['/events'], q ? { queryParams: { q } } : {});
  }

  protected openBell(): void {
    if (!this.bellLoaded() && !this.bellLoading()) {
      this.loadAttention();
    }
  }

  protected onBellToggle(event: Event): void {
    if ((event.target as HTMLDetailsElement).open) {
      this.openBell();
    }
  }

  private loadAttention(): void {
    this.bellLoading.set(true);
    const reports$ = this.canApproveReports
      ? this.reportsApi
          .list({ status: 'submitted', pageSize: 1 })
          .pipe(map((response) => response.pagination.total))
      : of(0);

    forkJoin({ events: this.eventsApi.listAllMine(), pendingReports: reports$ }).subscribe({
      next: ({ events, pendingReports }) => {
        const now = Date.now();
        const items: AttentionItem[] = [];
        const drafts = events.filter((event) => event.status === 'draft').length;
        if (drafts > 0) {
          items.push({
            label: `${formatNumber(drafts)} draf belum diterbitkan`,
            detail: 'Lengkapi detail lalu terbitkan agar bisa dilihat peserta.',
            href: '/events',
            queryParams: { status: 'draft' },
            action: 'Lengkapi draf',
          });
        }
        const startingSoon = events.filter(
          (event) =>
            event.status === 'published' &&
            +new Date(event.starts_at) >= now &&
            +new Date(event.starts_at) <= now + WEEK_MS,
        ).length;
        if (startingSoon > 0) {
          items.push({
            label: `${formatNumber(startingSoon)} event mulai dalam 7 hari`,
            detail: 'Periksa jadwal, harga, dan kesiapan lokasi.',
            href: '/jadwal',
            action: 'Cek jadwal',
          });
        }
        if (pendingReports > 0) {
          items.push({
            label: `${formatNumber(pendingReports)} laporan menunggu tinjauan`,
            detail: 'Laporan yang dikirim tim perlu keputusan.',
            href: '/laporan',
            queryParams: { status: 'submitted' },
            action: 'Tinjau laporan',
          });
        }
        this.attention.set(items);
        this.bellLoaded.set(true);
        this.bellLoading.set(false);
      },
      error: () => {
        this.bellLoaded.set(true);
        this.bellLoading.set(false);
      },
    });
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/masuk']);
  }
}
