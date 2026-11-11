import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { ReviewService } from '../../core/api/review.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { Event } from '../../core/models/event.model';
import { Review, ReviewSummary } from '../../core/models/review.model';
import { errorMessage } from '../../core/util/errors';
import { formatDateTime } from '../../core/util/format';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';

const REVIEW_PAGE_SIZE = 10;

@Component({
  selector: 'app-reviews',
  imports: [RouterLink, LucideAngularModule, EmptyState, ErrorState],
  templateUrl: './reviews.html',
})
export class ReviewsPage {
  private readonly eventsApi = inject(EventService);
  private readonly reviewsApi = inject(ReviewService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly canWrite = this.auth.has(PERMISSIONS.eventWrite);

  protected readonly events = signal<Event[]>([]);
  protected readonly eventsLoading = signal(true);
  protected readonly eventsError = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly reviews = signal<Review[]>([]);
  protected readonly summary = signal<ReviewSummary | null>(null);
  protected readonly reviewsLoading = signal(false);
  protected readonly reviewsError = signal<string | null>(null);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly page = signal(1);

  protected readonly selectedEvent = computed(
    () => this.events().find((event) => event.id === this.selectedId()) ?? null,
  );

  constructor() {
    this.loadEvents();
  }

  protected loadEvents(): void {
    this.eventsLoading.set(true);
    this.eventsError.set(null);
    this.eventsApi.listMine({ pageSize: 100 }).subscribe({
      next: (response) => {
        this.events.set(response.data);
        this.eventsLoading.set(false);
        if (response.data.length > 0) {
          const initial =
            response.data.find((event) => event.review_count > 0) ?? response.data[0];
          this.selectedId.set(initial.id);
          this.loadReviews(1, true);
        }
      },
      error: (error: unknown) => {
        this.eventsError.set(errorMessage(error));
        this.eventsLoading.set(false);
      },
    });
  }

  protected selectEvent(value: string): void {
    if (!value || value === this.selectedId()) {
      return;
    }
    this.selectedId.set(value);
    this.reviews.set([]);
    this.summary.set(null);
    this.loadReviews(1, true);
  }

  protected onEventChange(change: globalThis.Event): void {
    this.selectEvent((change.target as HTMLSelectElement).value);
  }

  protected loadReviews(page: number, replace = false): void {
    const eventId = this.selectedId();
    if (!eventId) {
      return;
    }
    if (replace) {
      this.reviewsLoading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    this.reviewsError.set(null);

    this.reviewsApi.listForEvent(eventId, page, REVIEW_PAGE_SIZE).subscribe({
      next: (response) => {
        this.summary.set(response.summary);
        this.page.set(page);
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

  protected loadMore(): void {
    this.loadReviews(this.page() + 1);
  }

  protected goCreate(): void {
    this.router.navigate(['/events/baru']);
  }

  protected stars(rating: number): number[] {
    const filled = Math.round(rating);
    return [1, 2, 3, 4, 5].map((value) => (value <= filled ? 1 : 0));
  }

  protected readonly formatDateTime = formatDateTime;
}
