import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { ReviewService } from '../../core/api/review.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  Event,
  EventStatus,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_LABEL,
} from '../../core/models/event.model';
import { Review, ReviewSummary } from '../../core/models/review.model';
import { errorMessage } from '../../core/util/errors';
import {
  formatDateTime,
  formatEventDate,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatPriceRange,
  formatTimeRange,
} from '../../core/util/format';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

type PendingKind = 'cancel' | 'delete';

const REVIEW_PAGE_SIZE = 5;

@Component({
  selector: 'app-event-detail',
  imports: [RouterLink, LucideAngularModule, StatusBadge, ErrorState, ConfirmDialog],
  templateUrl: './event-detail.html',
})
export class EventDetailPage {
  private readonly eventsApi = inject(EventService);
  private readonly reviewsApi = inject(ReviewService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly canWrite = this.auth.has(PERMISSIONS.eventWrite);
  protected readonly canDelete = this.auth.has(PERMISSIONS.eventDelete);
  protected readonly canPublish = this.auth.has(PERMISSIONS.eventPublish);

  protected readonly event = signal<Event | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly pending = signal<PendingKind | null>(null);
  protected readonly confirming = signal(false);

  protected readonly reviews = signal<Review[]>([]);
  protected readonly summary = signal<ReviewSummary | null>(null);
  protected readonly reviewsLoading = signal(true);
  protected readonly reviewsError = signal<string | null>(null);
  protected readonly reviewsPage = signal(1);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);

  protected readonly editable = computed(() => {
    const event = this.event();
    return !!event && event.status !== 'completed' && event.status !== 'cancelled';
  });

  protected readonly nextAction = computed<{ label: string; status: EventStatus } | null>(() => {
    const event = this.event();
    if (!event || !this.canPublish) {
      return null;
    }
    if (event.status === 'draft') {
      return { label: 'Terbitkan event', status: 'published' };
    }
    if (event.status === 'published') {
      return { label: 'Tandai berlangsung', status: 'ongoing' };
    }
    if (event.status === 'ongoing') {
      return { label: 'Tandai selesai', status: 'completed' };
    }
    return null;
  });

  protected readonly dialogTitle = computed(() =>
    this.pending() === 'delete' ? 'Hapus event' : 'Batalkan event',
  );
  protected readonly dialogMessage = computed(() => {
    const event = this.event();
    if (!event) {
      return '';
    }
    return this.pending() === 'delete'
      ? `Event “${event.title}” akan dihapus. Tindakan ini tidak bisa dibatalkan.`
      : `Event “${event.title}” akan berstatus dibatalkan dan tidak bisa dikembalikan ke draf.`;
  });

  constructor() {
    const state = this.route.snapshot.queryParamMap.get('state');
    if (state === 'published') {
      this.notice.set('Event berhasil diterbitkan.');
    } else if (state === 'draft') {
      this.notice.set('Draf event berhasil disimpan.');
    }
    this.load();
    this.loadReviews(1, true);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.eventsApi.get(this.eventId).subscribe({
      next: ({ data }) => {
        this.event.set(data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected loadReviews(page: number, replace = false): void {
    if (replace) {
      this.reviewsLoading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    this.reviewsError.set(null);

    this.reviewsApi.listForEvent(this.eventId, page, REVIEW_PAGE_SIZE).subscribe({
      next: (response) => {
        this.summary.set(response.summary);
        this.reviewsPage.set(page);
        this.hasMore.set(response.data.length === REVIEW_PAGE_SIZE);
        this.reviews.set(replace ? response.data : [...this.reviews(), ...response.data]);
        this.reviewsLoading.set(false);
        this.loadingMore.set(false);
      },
      error: (error: unknown) => {
        this.reviewsError.set(errorMessage(error));
        this.reviewsLoading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  protected loadMoreReviews(): void {
    this.loadReviews(this.reviewsPage() + 1);
  }

  protected transition(status: EventStatus): void {
    const event = this.event();
    if (!event || status === 'draft' || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.actionError.set(null);
    this.eventsApi.changeStatus(event.id, status).subscribe({
      next: ({ data }) => {
        this.busy.set(false);
        this.event.set(data);
        this.notice.set(`Status event diperbarui menjadi ${EVENT_STATUS_LABEL[data.status]}.`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(errorMessage(error));
      },
    });
  }

  protected ask(kind: PendingKind): void {
    this.actionError.set(null);
    this.pending.set(kind);
  }

  protected closeDialog(): void {
    if (!this.confirming()) {
      this.pending.set(null);
    }
  }

  protected confirmPending(): void {
    const kind = this.pending();
    const event = this.event();
    if (!kind || !event || this.confirming()) {
      return;
    }
    this.confirming.set(true);

    const request =
      kind === 'delete'
        ? this.eventsApi.remove(event.id)
        : this.eventsApi.changeStatus(event.id, 'cancelled').pipe(
            map(() => undefined),
          );

    request.subscribe({
      next: () => {
        this.confirming.set(false);
        this.pending.set(null);
        if (kind === 'delete') {
          this.router.navigate(['/events'], { queryParams: { deleted: '1' } });
          return;
        }
        this.notice.set('Event dibatalkan.');
        this.load();
      },
      error: (error: unknown) => {
        this.confirming.set(false);
        this.pending.set(null);
        this.actionError.set(errorMessage(error));
      },
    });
  }

  protected typeLabel(type: Event['type']): string {
    return EVENT_TYPE_LABEL[type];
  }

  protected priceLabel(event: Event): string {
    return formatPriceRange(event.price_min, event.price_max, event.currency);
  }

  protected donationPercent(event: Event): number {
    const target = event.donation_target ?? 0;
    if (target <= 0) {
      return 0;
    }
    return Math.min(100, Math.round(((event.donation_raised ?? 0) / target) * 100));
  }

  protected stars(rating: number): number[] {
    const filled = Math.round(rating);
    return [1, 2, 3, 4, 5].map((value) => (value <= filled ? 1 : 0));
  }

  protected readonly formatLongDate = formatLongDate;
  protected readonly formatEventDate = formatEventDate;
  protected readonly formatTimeRange = formatTimeRange;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatMoney = formatMoney;
  protected readonly formatNumber = formatNumber;
}
