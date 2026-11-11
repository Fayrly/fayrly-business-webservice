import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { Event, EVENT_TYPE_LABEL } from '../../core/models/event.model';
import { errorMessage } from '../../core/util/errors';
import {
  formatNumber,
  formatPriceRange,
  formatTimeRange,
} from '../../core/util/format';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

type Period = 'upcoming' | 'past' | 'all';

interface MonthGroup {
  key: string;
  label: string;
  events: Event[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_FORMAT = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});

@Component({
  selector: 'app-schedule',
  imports: [RouterLink, LucideAngularModule, StatusBadge, EmptyState, ErrorState],
  templateUrl: './schedule.html',
})
export class SchedulePage {
  private readonly eventsApi = inject(EventService);
  private readonly auth = inject(AuthService);

  protected readonly canWrite = this.auth.has(PERMISSIONS.eventWrite);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly events = signal<Event[]>([]);
  protected readonly period = signal<Period>('upcoming');

  protected readonly tabs: { value: Period; label: string }[] = [
    { value: 'upcoming', label: 'Mendatang' },
    { value: 'past', label: 'Sudah lewat' },
    { value: 'all', label: 'Semua' },
  ];

  protected readonly upcoming = computed(() => {
    const now = Date.now();
    return this.events()
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
  });

  protected readonly summary = computed(() => {
    const now = Date.now();
    const upcoming = this.upcoming();
    const starting = (days: number) =>
      upcoming.filter((event) => {
        const start = +new Date(event.starts_at);
        return start >= now && start <= now + days * DAY_MS;
      }).length;
    return {
      week: starting(7),
      month: starting(30),
      total: upcoming.length,
    };
  });

  protected readonly filtered = computed(() => {
    const period = this.period();
    if (period === 'upcoming') {
      return this.upcoming();
    }
    const now = Date.now();
    if (period === 'past') {
      return this.events()
        .filter((event) => {
          if (event.status === 'completed' || event.status === 'cancelled') {
            return true;
          }
          return event.status !== 'ongoing' && +new Date(event.starts_at) < now;
        })
        .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
    }
    return [...this.events()].sort(
      (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at),
    );
  });

  protected readonly groups = computed<MonthGroup[]>(() => {
    const groups: MonthGroup[] = [];
    for (const event of this.filtered()) {
      const key = this.monthKey(event.starts_at);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = {
          key,
          label: this.monthLabel(event.starts_at),
          events: [],
        };
        groups.push(group);
      }
      group.events.push(event);
    }
    return groups;
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

  protected setPeriod(period: Period): void {
    this.period.set(period);
  }

  protected isEditable(event: Event): boolean {
    return event.status !== 'completed' && event.status !== 'cancelled';
  }

  protected typeLabel(event: Event): string {
    return EVENT_TYPE_LABEL[event.type];
  }

  protected priceLabel(event: Event): string {
    return formatPriceRange(event.price_min, event.price_max, event.currency);
  }

  protected timeLabel(event: Event): string {
    return formatTimeRange(event.starts_at, event.ends_at);
  }

  protected dayOf(value: string): string {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
  }

  protected weekdayOf(value: string): string {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
  }

  private monthLabel(value: string): string {
    return MONTH_FORMAT.format(new Date(value));
  }

  private monthKey(value: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
  }

  protected readonly formatNumber = formatNumber;
}
