import { Component, computed, input } from '@angular/core';
import {
  EVENT_STATUS_LABEL,
  EventStatus,
} from '../../../core/models/event.model';
import { REPORT_STATUS_LABEL, ReportStatus } from '../../../core/models/report.model';
import { USER_STATUS_LABEL, UserStatus } from '../../../core/models/user.model';

type Tone = 'neutral' | 'mint' | 'outline' | 'danger';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-600',
  mint: 'border-mint-200 bg-mint-50 text-mint-800',
  outline: 'border-mint-200 bg-white text-mint-700',
  danger: 'border-crimson-100 bg-crimson-50 text-crimson-700',
};

@Component({
  selector: 'app-status-badge',
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
      [class]="toneClasses()"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true"></span>
      {{ label() }}
    </span>
  `,
})
export class StatusBadge {
  readonly status = input.required<string>();
  readonly kind = input<'event' | 'report' | 'user'>('event');

  protected readonly label = computed(() => {
    const status = this.status();
    if (this.kind() === 'report') {
      return REPORT_STATUS_LABEL[status as ReportStatus] ?? status;
    }
    if (this.kind() === 'user') {
      return USER_STATUS_LABEL[status as UserStatus] ?? status;
    }
    return EVENT_STATUS_LABEL[status as EventStatus] ?? status;
  });

  protected readonly toneClasses = computed(() => {
    const status = this.status();
    const kind = this.kind();
    let tone: Tone = 'neutral';
    if (kind === 'report') {
      if (status === 'approved') {
        tone = 'mint';
      } else if (status === 'submitted') {
        tone = 'outline';
      } else if (status === 'rejected') {
        tone = 'danger';
      }
    } else if (kind === 'user') {
      if (status === 'active') {
        tone = 'mint';
      } else if (status === 'suspended') {
        tone = 'danger';
      }
    } else {
      if (status === 'published') {
        tone = 'mint';
      } else if (status === 'ongoing') {
        tone = 'outline';
      } else if (status === 'cancelled') {
        tone = 'danger';
      } else if (status === 'completed') {
        tone = 'neutral';
      }
    }
    return TONE_CLASSES[tone];
  });
}
