import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { ReportService } from '../../core/api/report.service';
import { ReviewService } from '../../core/api/review.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  Event,
  EventStatus,
  EVENT_STATUSES,
  EVENT_STATUS_LABEL,
} from '../../core/models/event.model';
import { Review } from '../../core/models/review.model';
import { Report, REPORT_STATUS_LABEL } from '../../core/models/report.model';
import { errorMessage } from '../../core/util/errors';
import {
  formatEventDate,
  formatNumber,
  formatRelativeTime,
  formatShortDate,
} from '../../core/util/format';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

interface StatusCounts {
  draft: number;
  published: number;
  ongoing: number;
  completed: number;
  cancelled: number;
}

interface OverviewData {
  total: number;
  counts: StatusCounts;
  active: number;
  upcoming: Event[];
  ongoing: Event[];
  capacityUpcoming: number;
  reviewCount: number;
  ratingAvg: number | null;
  reviews: Review[];
  reports: Report[];
  startingSoon: Event[];
  pendingReports: number;
  donations: Event[];
}

interface StatCard {
  label: string;
  value: string;
  hint: string;
  href: string;
  queryParams?: Record<string, string>;
  tone: 'default' | 'mint' | 'danger';
}

interface StatusRow {
  status: EventStatus;
  label: string;
  count: number;
  href: string;
  queryParams: Record<string, string>;
  dot: string;
  bar: string;
}

interface ActivityItem {
  kind: 'review' | 'report';
  title: string;
  detail: string;
  time: string;
  initials: string;
}

interface DonutStat {
  label: string;
  display: string;
  percent: number;
  stroke: string;
  href: string;
  queryParams?: Record<string, string>;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-overview',
  imports: [RouterLink, LucideAngularModule, StatusBadge, EmptyState, ErrorState],
  templateUrl: './overview.html',
})
export class OverviewPage {
  private readonly auth = inject(AuthService);
  private readonly eventsApi = inject(EventService);
  private readonly reviewsApi = inject(ReviewService);
  private readonly reportsApi = inject(ReportService);

  protected readonly canWrite = this.auth.has(PERMISSIONS.eventWrite);
  protected readonly canApproveReports = this.auth.has(PERMISSIONS.reportApprove);
  protected readonly userName = this.auth.user()?.name ?? '';
  protected readonly today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<OverviewData | null>(null);

  protected readonly stats = computed<StatCard[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    return [
      {
        label: 'Event aktif',
        value: formatNumber(data.active),
        hint: `${formatNumber(data.counts.published)} terbit · ${formatNumber(data.counts.ongoing)} berlangsung`,
        href: '/events',
        queryParams: { status: 'published' },
        tone: 'mint',
      },
      {
        label: 'Draf',
        value: formatNumber(data.counts.draft),
        hint: 'Belum diterbitkan',
        href: '/events',
        queryParams: { status: 'draft' },
        tone: 'default',
      },
      {
        label: 'Jadwal aktif',
        value: formatNumber(data.upcoming.length),
        hint: 'Termasuk draf & berlangsung',
        href: '/jadwal',
        tone: 'default',
      },
      {
        label: 'Kapasitas terjadwal',
        value: formatNumber(data.capacityUpcoming),
        hint: 'Kursi event aktif',
        href: '/jadwal',
        tone: 'default',
      },
      {
        label: 'Rating peserta',
        value:
          data.ratingAvg === null ? '—' : data.ratingAvg.toFixed(1).replace('.', ','),
        hint: 'Skala 1–5',
        href: '/ulasan',
        tone: 'mint',
      },
      {
        label: 'Total ulasan',
        value: formatNumber(data.reviewCount),
        hint: 'Dari semua event',
        href: '/ulasan',
        tone: 'default',
      },
    ];
  });

  protected readonly upcomingPreview = computed(
    () => this.data()?.upcoming.slice(0, 5) ?? [],
  );

  protected readonly activities = computed<ActivityItem[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    const items: ActivityItem[] = [
      ...data.reviews.map((review) => ({
        kind: 'review' as const,
        title: `${review.user_name} memberikan ulasan ${review.rating}/5`,
        detail: review.event_title,
        time: review.created_at,
        initials: this.initialsOf(review.user_name),
      })),
      ...data.reports.map((report) => ({
        kind: 'report' as const,
        title: report.title,
        detail: `${report.created_by_name} · ${REPORT_STATUS_LABEL[report.status]}`,
        time: report.updated_at,
        initials: this.initialsOf(report.created_by_name),
      })),
    ];
    return items
      .sort((a, b) => +new Date(b.time) - +new Date(a.time))
      .slice(0, 6);
  });

  protected readonly donutStats = computed<DonutStat[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    const publishedPercent =
      data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;
    const donationTargets = data.donations.reduce(
      (sum, event) => sum + (event.donation_target ?? 0),
      0,
    );
    const donationRaised = data.donations.reduce(
      (sum, event) => sum + (event.donation_raised ?? 0),
      0,
    );
    const donationPercent =
      donationTargets > 0 ? Math.min(100, Math.round((donationRaised / donationTargets) * 100)) : 0;
    return [
      {
        label: 'Event terbit',
        display: `${formatNumber(data.active)} dari ${formatNumber(data.total)}`,
        percent: publishedPercent,
        stroke: 'var(--color-mint-600)',
        href: '/events',
        queryParams: { status: 'published' },
      },
      {
        label: 'Donasi amal',
        display:
          donationTargets > 0
            ? `${donationPercent}%`
            : '—',
        percent: donationPercent,
        stroke: 'var(--color-crimson-500)',
        href: '/events',
        queryParams: { status: 'published' },
      },
      {
        label: 'Rating peserta',
        display:
          data.ratingAvg === null
            ? '—'
            : `${data.ratingAvg.toFixed(1).replace('.', ',')} dari 5`,
        percent: data.ratingAvg === null ? 0 : Math.round((data.ratingAvg / 5) * 100),
        stroke: 'var(--color-slate-400)',
        href: '/ulasan',
      },
    ];
  });

  protected readonly statusRows = computed<StatusRow[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    const colors: Record<EventStatus, string> = {
      draft: 'bg-slate-300',
      published: 'bg-mint-700',
      ongoing: 'bg-mint-500',
      completed: 'bg-slate-500',
      cancelled: 'bg-crimson-500',
    };
    return EVENT_STATUSES.map((status) => ({
      status,
      label: EVENT_STATUS_LABEL[status],
      count: data.counts[status],
      href: '/events',
      queryParams: { status },
      dot: colors[status],
      bar: colors[status],
    }));
  });

  protected readonly attention = computed(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    const items: {
      label: string;
      detail: string;
      href: string;
      queryParams?: Record<string, string>;
      action: string;
    }[] = [];
    if (data.counts.draft > 0) {
      items.push({
        label: `${formatNumber(data.counts.draft)} draf belum diterbitkan`,
        detail: 'Lengkapi detail lalu terbitkan agar bisa dilihat peserta.',
        href: '/events',
        queryParams: { status: 'draft' },
        action: 'Lengkapi draf',
      });
    }
    if (data.startingSoon.length > 0) {
      items.push({
        label: `${formatNumber(data.startingSoon.length)} event mulai dalam 7 hari`,
        detail: 'Periksa jadwal, harga, dan kesiapan lokasi.',
        href: '/jadwal',
        action: 'Cek jadwal',
      });
    }
    if (data.pendingReports > 0) {
      items.push({
        label: `${formatNumber(data.pendingReports)} laporan menunggu tinjauan`,
        detail: 'Laporan yang dikirim tim perlu keputusan.',
        href: '/laporan',
        queryParams: { status: 'submitted' },
        action: 'Tinjau laporan',
      });
    }
    return items;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.eventsApi
      .listAllMine()
      .pipe(
        switchMap((events) => {
          const candidates = [...events]
            .filter((event) => event.review_count > 0)
            .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
            .slice(0, 5);

          const reviews$ = candidates.length
            ? forkJoin(
                candidates.map((event) =>
                  this.reviewsApi
                    .listForEvent(event.id, 1, 3)
                    .pipe(map((response) => response.data)),
                ),
              ).pipe(
                map((groups) =>
                  groups
                    .flat()
                    .sort(
                      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
                    )
                    .slice(0, 5),
                ),
              )
            : of([] as Review[]);

          const reports$ = this.reportsApi.list({ pageSize: 5 }).pipe(
            map((response) =>
              [...response.data].sort(
                (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
              ),
            ),
          );

          const pendingReports$ = this.canApproveReports
            ? this.reportsApi
                .list({ status: 'submitted', pageSize: 1 })
                .pipe(map((response) => response.pagination.total))
            : of(0);

          return forkJoin({
            events: of(events),
            reviews: reviews$,
            reports: reports$,
            pendingReports: pendingReports$,
          });
        }),
      )
      .subscribe({
        next: ({ events, reviews, reports, pendingReports }) => {
          const now = Date.now();
          const counts = events.reduce<StatusCounts>(
            (acc, event) => {
              acc[event.status] += 1;
              return acc;
            },
            { draft: 0, published: 0, ongoing: 0, completed: 0, cancelled: 0 },
          );
          const upcoming = events
            .filter((event) => {
              if (event.status === 'cancelled' || event.status === 'completed') {
                return false;
              }
              if (event.status === 'ongoing') {
                return true;
              }
              return +new Date(event.starts_at) >= now;
            })
            .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
          const rated = events.filter((event) => event.review_count > 0);
          const reviewCount = rated.reduce(
            (sum, event) => sum + event.review_count,
            0,
          );
          const ratingAvg =
            reviewCount > 0
              ? rated.reduce(
                  (sum, event) => sum + event.rating_avg * event.review_count,
                  0,
                ) / reviewCount
              : null;
          const capacityUpcoming = upcoming
            .filter(
              (event) =>
                event.status === 'published' || event.status === 'ongoing',
            )
            .reduce((sum, event) => sum + Math.max(0, event.capacity), 0);
          const startingSoon = events.filter(
            (event) =>
              event.status === 'published' &&
              +new Date(event.starts_at) >= now &&
              +new Date(event.starts_at) <= now + WEEK_MS,
          );
          const donations = events
            .filter(
              (event) =>
                event.type === 'charity' && (event.donation_target ?? 0) > 0,
            )
            .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at))
            .slice(0, 3);

          this.data.set({
            total: events.length,
            counts,
            active: counts.published + counts.ongoing,
            upcoming,
            ongoing: upcoming.filter((event) => event.status === 'ongoing').slice(0, 3),
            capacityUpcoming,
            reviewCount,
            ratingAvg,
            reviews,
            reports,
            startingSoon,
            pendingReports,
            donations,
          });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          this.loading.set(false);
        },
      });
  }

  protected statusLabel(status: EventStatus): string {
    return EVENT_STATUS_LABEL[status];
  }

  protected typeCardClass(event: Event): string {
    const classes: Record<Event['type'], string> = {
      concert: 'bg-mint-50 text-mint-800',
      charity: 'bg-crimson-50 text-crimson-700',
      community: 'bg-slate-100 text-slate-700',
    };
    return classes[event.type];
  }

  protected typeIcon(event: Event): string {
    const icons: Record<Event['type'], string> = {
      concert: 'music',
      charity: 'heart-handshake',
      community: 'users',
    };
    return icons[event.type];
  }

  protected attendeePercent(event: Event): number | null {
    if (event.capacity <= 0) {
      return null;
    }
    return Math.min(100, Math.round((event.going_count / event.capacity) * 100));
  }

  protected attendeeNames(event: Event): string[] {
    return event.going_names.slice(0, 3);
  }

  protected capacityLabel(event: Event): string {
    return event.capacity > 0 ? `${formatNumber(event.capacity)} kursi` : 'Tanpa batas';
  }

  protected initialsOf(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  protected stars(rating: number): number[] {
    const filled = Math.round(rating);
    return [1, 2, 3, 4, 5].map((value) => (value <= filled ? 1 : 0));
  }

  protected firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
  }

  protected donationPercent(event: Event): number {
    const target = event.donation_target ?? 0;
    if (target <= 0) {
      return 0;
    }
    return Math.min(100, Math.round(((event.donation_raised ?? 0) / target) * 100));
  }

  protected donationSummary(event: Event): string {
    const currency = event.currency || 'IDR';
    return `${this.currencyLabel(event.donation_raised ?? 0, currency)} dari ${this.currencyLabel(
      event.donation_target ?? 0,
      currency,
    )}`;
  }

  private currencyLabel(value: number, currency: string): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected readonly formatEventDate = formatEventDate;
  protected readonly formatNumber = formatNumber;
  protected readonly formatRelativeTime = formatRelativeTime;
  protected readonly formatShortDate = formatShortDate;
}
