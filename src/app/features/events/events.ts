import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  Event,
  EventStatus,
  EVENT_STATUSES,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_LABEL,
} from '../../core/models/event.model';
import { Pagination } from '../../core/models/pagination.model';
import { errorMessage } from '../../core/util/errors';
import {
  formatEventDate,
  formatNumber,
  formatPriceRange,
} from '../../core/util/format';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

type PendingAction = { kind: 'delete' | 'cancel'; event: Event };

const PAGE_SIZE = 10;

@Component({
  selector: 'app-events',
  imports: [
    RouterLink,
    LucideAngularModule,
    StatusBadge,
    EmptyState,
    ErrorState,
    ConfirmDialog,
  ],
  templateUrl: './events.html',
})
export class EventsPage {
  private readonly eventsApi = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly canWrite = this.auth.has(PERMISSIONS.eventWrite);
  protected readonly canDelete = this.auth.has(PERMISSIONS.eventDelete);
  protected readonly canPublish = this.auth.has(PERMISSIONS.eventPublish);

  protected readonly events = signal<Event[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly pending = signal<PendingAction | null>(null);
  protected readonly confirming = signal(false);

  protected readonly search = signal('');
  protected readonly status = signal<EventStatus | ''>('');
  protected readonly page = signal(1);
  protected readonly statuses = EVENT_STATUSES;

  protected readonly hasFilters = computed(() => !!this.search() || !!this.status());
  protected readonly dialogOpen = computed(() => this.pending() !== null);
  protected readonly dialogTitle = computed(() =>
    this.pending()?.kind === 'delete' ? 'Hapus event' : 'Batalkan event',
  );
  protected readonly dialogMessage = computed(() => {
    const pending = this.pending();
    if (!pending) {
      return '';
    }
    return pending.kind === 'delete'
      ? `Event “${pending.event.title}” akan dihapus. Tindakan ini tidak bisa dibatalkan.`
      : `Event “${pending.event.title}” akan berstatus dibatalkan. Event yang dibatalkan tidak bisa dikembalikan ke draf.`;
  });
  protected readonly dialogConfirmLabel = computed(() =>
    this.pending()?.kind === 'delete' ? 'Hapus event' : 'Batalkan event',
  );
  protected readonly dialogRequireText = computed(() =>
    this.pending()?.kind === 'delete' ? this.pending()?.event.title ?? null : null,
  );

  constructor() {
    const initialStatus = this.route.snapshot.queryParamMap.get('status');
    if (initialStatus && (EVENT_STATUSES as string[]).includes(initialStatus)) {
      this.status.set(initialStatus as EventStatus);
    }
    const initialQuery = this.route.snapshot.queryParamMap.get('q');
    if (initialQuery) {
      this.search.set(initialQuery);
    }
    this.load();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const q = params.get('q') ?? '';
      const status = params.get('status') ?? '';
      if (q !== this.search() || status !== this.status()) {
        this.search.set(q);
        this.status.set(
          status && (EVENT_STATUSES as string[]).includes(status)
            ? (status as EventStatus)
            : '',
        );
        this.page.set(1);
        this.load();
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.eventsApi
      .listMine({
        q: this.search().trim(),
        status: this.status() || undefined,
        page: this.page(),
        pageSize: PAGE_SIZE,
      })
      .subscribe({
        next: (response) => {
          this.events.set(response.data);
          this.pagination.set(response.pagination);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          this.loading.set(false);
        },
      });
  }

  protected applySearch(): void {
    this.page.set(1);
    this.syncUrl();
    this.load();
  }

  protected onSearchSubmit(event: globalThis.Event): void {
    event.preventDefault();
    this.applySearch();
  }

  protected onSearchInput(event: globalThis.Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected changeStatus(value: string): void {
    this.status.set(value as EventStatus | '');
    this.page.set(1);
    this.syncUrl();
    this.load();
  }

  protected onStatusChange(event: globalThis.Event): void {
    this.changeStatus((event.target as HTMLSelectElement).value);
  }

  protected goCreate(): void {
    this.router.navigate(['/events/baru']);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set('');
    this.page.set(1);
    this.syncUrl();
    this.load();
  }

  protected goToPage(page: number): void {
    const totalPages = this.pagination()?.total_pages ?? 1;
    if (page < 1 || page > totalPages || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  protected nextAction(event: Event): { label: string; status: EventStatus } | null {
    if (!this.canPublish) {
      return null;
    }
    if (event.status === 'draft') {
      return { label: 'Terbitkan', status: 'published' };
    }
    if (event.status === 'published') {
      return { label: 'Mulai', status: 'ongoing' };
    }
    if (event.status === 'ongoing') {
      return { label: 'Selesaikan', status: 'completed' };
    }
    return null;
  }

  protected isEditable(event: Event): boolean {
    return event.status !== 'completed' && event.status !== 'cancelled';
  }

  protected transition(event: Event, status: EventStatus): void {
    if (status === 'draft') {
      return;
    }
    this.busyId.set(event.id);
    this.actionError.set(null);
    this.notice.set(null);

    this.eventsApi.changeStatus(event.id, status).subscribe({
      next: (response) => {
        this.busyId.set(null);
        this.notice.set(
          `Event “${response.data.title}” sekarang berstatus ${EVENT_STATUS_LABEL[response.data.status]}.`,
        );
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.actionError.set(errorMessage(error));
      },
    });
  }

  protected askDelete(event: Event): void {
    this.actionError.set(null);
    this.pending.set({ kind: 'delete', event });
  }

  protected askCancel(event: Event): void {
    this.actionError.set(null);
    this.pending.set({ kind: 'cancel', event });
  }

  protected closeDialog(): void {
    if (!this.confirming()) {
      this.pending.set(null);
    }
  }

  protected confirmPending(): void {
    const pending = this.pending();
    if (!pending || this.confirming()) {
      return;
    }
    this.confirming.set(true);

    const request =
      pending.kind === 'delete'
        ? this.eventsApi.remove(pending.event.id)
        : this.eventsApi.changeStatus(pending.event.id, 'cancelled').pipe(
            map(() => undefined),
          );

    request.subscribe({
      next: () => {
        this.confirming.set(false);
        this.pending.set(null);
        this.notice.set(
          pending.kind === 'delete'
            ? `Event “${pending.event.title}” sudah dihapus.`
            : `Event “${pending.event.title}” sudah dibatalkan.`,
        );
        this.load();
      },
      error: (error: unknown) => {
        this.confirming.set(false);
        this.pending.set(null);
        this.actionError.set(errorMessage(error));
      },
    });
  }

  protected typeLabel(event: Event): string {
    return EVENT_TYPE_LABEL[event.type];
  }

  protected statusLabel(status: EventStatus): string {
    return EVENT_STATUS_LABEL[status];
  }

  protected priceLabel(event: Event): string {
    return formatPriceRange(event.price_min, event.price_max, event.currency);
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.search().trim() || null, status: this.status() || null },
      replaceUrl: true,
    });
  }

  protected readonly formatEventDate = formatEventDate;
  protected readonly formatNumber = formatNumber;
}
