import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { Event } from '../../core/models/event.model';
import { errorMessage } from '../../core/util/errors';
import {
  formatEventDate,
  formatMoney,
  formatNumber,
  formatPriceRange,
} from '../../core/util/format';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

type Scope = 'active' | 'all';

@Component({
  selector: 'app-pricing',
  imports: [RouterLink, LucideAngularModule, StatusBadge, EmptyState, ErrorState],
  templateUrl: './pricing.html',
})
export class PricingPage {
  private readonly eventsApi = inject(EventService);
  private readonly auth = inject(AuthService);

  protected readonly canWrite = this.auth.has(PERMISSIONS.eventWrite);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly events = signal<Event[]>([]);
  protected readonly scope = signal<Scope>('active');

  protected readonly scopes: { value: Scope; label: string }[] = [
    { value: 'active', label: 'Event aktif' },
    { value: 'all', label: 'Semua event' },
  ];

  protected readonly rows = computed(() => {
    const active = this.events().filter(
      (event) =>
        event.status === 'draft' ||
        event.status === 'published' ||
        event.status === 'ongoing',
    );
    const list = this.scope() === 'active' ? active : this.events();
    return [...list].sort(
      (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at),
    );
  });

  protected readonly summary = computed(() => {
    const active = this.events().filter(
      (event) =>
        event.status === 'draft' ||
        event.status === 'published' ||
        event.status === 'ongoing',
    );
    const paid = active.filter((event) => event.price_max > 0).length;
    const free = active.filter((event) => event.price_max <= 0).length;
    const currencies = new Set(active.map((event) => event.currency || 'IDR'));
    const currency = currencies.size === 1 ? [...currencies][0] : 'IDR';
    const lowest = active.length
      ? Math.min(...active.map((event) => Math.max(0, event.price_min)))
      : null;
    const highest = active.length
      ? Math.max(...active.map((event) => Math.max(0, event.price_max)))
      : null;
    return {
      paid,
      free,
      lowest,
      highest,
      currency,
    };
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.eventsApi.listAllMine().subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected setScope(scope: Scope): void {
    this.scope.set(scope);
  }

  protected isEditable(event: Event): boolean {
    return event.status !== 'completed' && event.status !== 'cancelled';
  }

  protected priceLabel(event: Event): string {
    return formatPriceRange(event.price_min, event.price_max, event.currency);
  }

  protected capacityLabel(event: Event): string {
    return event.capacity > 0 ? formatNumber(event.capacity) : 'Tanpa batas';
  }

  protected lowestLabel(): string {
    const summary = this.summary();
    if (summary.lowest === null) {
      return '—';
    }
    return summary.lowest <= 0
      ? 'Gratis'
      : formatMoney(summary.lowest, summary.currency);
  }

  protected highestLabel(): string {
    const summary = this.summary();
    if (summary.highest === null || summary.highest <= 0) {
      return '—';
    }
    return formatMoney(summary.highest, summary.currency);
  }

  protected readonly formatEventDate = formatEventDate;
  protected readonly formatNumber = formatNumber;
  protected readonly formatMoney = formatMoney;
}
