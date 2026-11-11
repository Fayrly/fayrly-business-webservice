import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HostListener } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { ReportService } from '../../core/api/report.service';
import { PERMISSIONS } from '../../core/auth/permissions';
import { Event } from '../../core/models/event.model';
import { ApiError } from '../../core/models/api-error.model';
import { Pagination } from '../../core/models/pagination.model';
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABEL,
  REPORT_TYPES,
  REPORT_TYPE_LABEL,
  Report,
  ReportPayload,
  ReportStatus,
  ReportType,
} from '../../core/models/report.model';
import { errorMessage } from '../../core/util/errors';
import {
  dateInputToIso,
  formatDateTime,
  formatShortDate,
} from '../../core/util/format';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-reports',
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    StatusBadge,
    EmptyState,
    ErrorState,
    ConfirmDialog,
  ],
  templateUrl: './reports.html',
})
export class ReportsPage {
  private readonly reportsApi = inject(ReportService);
  private readonly eventsApi = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly canWrite = this.auth.has(PERMISSIONS.reportWrite);
  protected readonly canApprove = this.auth.has(PERMISSIONS.reportApprove);
  protected readonly myId = this.auth.user()?.id ?? '';

  protected readonly reports = signal<Report[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly query = signal('');
  protected readonly status = signal<ReportStatus | ''>('');
  protected readonly type = signal<ReportType | ''>('');
  protected readonly mine = signal(false);
  protected readonly page = signal(1);

  protected readonly types = REPORT_TYPES;
  protected readonly statuses = REPORT_STATUSES;
  protected readonly typeLabels = REPORT_TYPE_LABEL;
  protected readonly statusLabels = REPORT_STATUS_LABEL;

  protected readonly selected = signal<Report | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  protected readonly actionBusy = signal(false);
  protected readonly reviewDecision = signal<'approved' | 'rejected'>('approved');
  protected readonly reviewNotes = signal('');
  protected readonly reviewError = signal<string | null>(null);
  protected readonly reviewing = signal(false);

  protected readonly pendingDelete = signal<Report | null>(null);
  protected readonly deleting = signal(false);

  protected readonly events = signal<Event[]>([]);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formSaving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      type: ['financial' as ReportType, [Validators.required]],
      event_id: [''],
      event_title: ['', [Validators.maxLength(200)]],
      period_start: [''],
      period_end: [''],
      summary: ['', [Validators.maxLength(10000)]],
      metrics: ['', [metricsValidator]],
    },
    { validators: [periodValidator] },
  );

  protected readonly hasFilters = computed(
    () => !!this.query() || !!this.status() || !!this.type() || this.mine(),
  );

  constructor() {
    const initialStatus = this.route.snapshot.queryParamMap.get('status');
    if (initialStatus && (REPORT_STATUSES as string[]).includes(initialStatus)) {
      this.status.set(initialStatus as ReportStatus);
    }
    this.load();
    this.loadEvents();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reportsApi
      .list({
        q: this.query().trim(),
        status: this.status() || undefined,
        type: this.type() || undefined,
        mine: this.mine(),
        page: this.page(),
        pageSize: PAGE_SIZE,
      })
      .subscribe({
        next: (response) => {
          this.reports.set(response.data);
          this.pagination.set(response.pagination);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          this.loading.set(false);
        },
      });
  }

  protected loadEvents(): void {
    this.eventsApi.listMine({ pageSize: 100 }).subscribe({
      next: (response) => this.events.set(response.data),
      error: () => this.events.set([]),
    });
  }

  protected onSearchInput(event: globalThis.Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: globalThis.Event): void {
    this.status.set((event.target as HTMLSelectElement).value as ReportStatus | '');
  }

  protected onTypeChange(event: globalThis.Event): void {
    this.type.set((event.target as HTMLSelectElement).value as ReportType | '');
  }

  protected onMineChange(event: globalThis.Event): void {
    this.mine.set((event.target as HTMLInputElement).checked);
  }

  protected applyFilters(event?: globalThis.Event): void {
    event?.preventDefault();
    this.page.set(1);
    this.load();
  }

  protected clearFilters(): void {
    this.query.set('');
    this.status.set('');
    this.type.set('');
    this.mine.set(false);
    this.page.set(1);
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

  protected openReport(id: string): void {
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.reviewError.set(null);
    this.reviewDecision.set('approved');
    this.reviewNotes.set('');
    this.reportsApi.get(id).subscribe({
      next: ({ data }) => {
        this.selected.set(data);
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.detailError.set(errorMessage(error));
        this.detailLoading.set(false);
        this.selected.set(null);
      },
    });
  }

  protected closeDetail(): void {
    if (!this.actionBusy()) {
      this.selected.set(null);
    }
  }

  protected isOwn(report: Report): boolean {
    return report.created_by === this.myId;
  }

  protected canReview(report: Report): boolean {
    return this.canApprove && report.status === 'submitted' && !this.isOwn(report);
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.formError.set(null);
    this.form.reset({
      title: '',
      type: 'financial',
      event_id: '',
      event_title: '',
      period_start: '',
      period_end: '',
      summary: '',
      metrics: '',
    });
    this.formOpen.set(true);
  }

  protected openEdit(report: Report): void {
    this.editingId.set(report.id);
    this.formError.set(null);
    this.form.reset({
      title: report.title,
      type: report.type,
      event_id: report.event_id ?? '',
      event_title: report.event_title,
      period_start: report.period_start ?? '',
      period_end: report.period_end ?? '',
      summary: report.summary,
      metrics:
        report.metrics && Object.keys(report.metrics).length > 0
          ? JSON.stringify(report.metrics, null, 2)
          : '',
    });
    this.selected.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    if (!this.formSaving()) {
      this.formOpen.set(false);
    }
  }

  protected onEventSelect(change: globalThis.Event): void {
    const id = (change.target as HTMLSelectElement).value;
    const event = this.events().find((item) => item.id === id);
    if (event) {
      this.form.controls.event_title.setValue(event.title);
    }
  }

  protected hasCustomEvent(): boolean {
    const id = this.form.controls.event_id.value;
    return !!id && !this.events().some((event) => event.id === id);
  }

  protected saveForm(): void {
    if (this.formSaving()) {
      return;
    }
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Periksa kembali isian laporan.');
      return;
    }

    let metrics: Record<string, unknown> = {};
    const rawMetrics = this.form.controls.metrics.value.trim();
    if (rawMetrics) {
      try {
        metrics = JSON.parse(rawMetrics) as Record<string, unknown>;
      } catch {
        this.formError.set('Metrik bukan JSON yang valid.');
        return;
      }
    }

    const payload: ReportPayload = {
      title: this.form.controls.title.value.trim(),
      type: this.form.controls.type.value,
      event_id: this.form.controls.event_id.value || '',
      event_title: this.form.controls.event_title.value.trim(),
      period_start: this.form.controls.period_start.value || null,
      period_end: this.form.controls.period_end.value || null,
      summary: this.form.controls.summary.value.trim(),
      metrics,
    };

    this.formSaving.set(true);
    const id = this.editingId();
    const request = id
      ? this.reportsApi.update(id, payload)
      : this.reportsApi.create(payload);

    request.subscribe({
      next: ({ data }) => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.notice.set(
          id ? `Laporan “${data.title}” berhasil diperbarui.` : `Draf laporan “${data.title}” dibuat.`,
        );
        this.load();
        this.selected.set(data);
      },
      error: (error: unknown) => {
        this.formSaving.set(false);
        this.applyFormError(error);
      },
    });
  }

  protected submitReport(report: Report): void {
    if (this.actionBusy()) {
      return;
    }
    this.actionBusy.set(true);
    this.actionError.set(null);
    this.reportsApi.submit(report.id).subscribe({
      next: ({ data }) => {
        this.actionBusy.set(false);
        this.selected.set(data);
        this.notice.set('Laporan dikirim untuk ditinjau.');
        this.load();
      },
      error: (error: unknown) => {
        this.actionBusy.set(false);
        this.actionError.set(errorMessage(error));
      },
    });
  }

  protected review(report: Report): void {
    if (this.reviewing()) {
      return;
    }
    const notes = this.reviewNotes().trim();
    if (this.reviewDecision() === 'rejected' && !notes) {
      this.reviewError.set('Catatan wajib diisi saat menolak laporan.');
      return;
    }
    this.reviewError.set(null);
    this.reviewing.set(true);
    this.reportsApi
      .review(report.id, { decision: this.reviewDecision(), notes })
      .subscribe({
        next: ({ data }) => {
          this.reviewing.set(false);
          this.selected.set(data);
          this.notice.set(
            data.status === 'approved' ? 'Laporan disetujui.' : 'Laporan ditolak.',
          );
          this.load();
        },
        error: (error: unknown) => {
          this.reviewing.set(false);
          this.reviewError.set(errorMessage(error));
        },
      });
  }

  protected askDelete(report: Report): void {
    this.actionError.set(null);
    this.pendingDelete.set(report);
  }

  protected cancelDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected confirmDelete(): void {
    const report = this.pendingDelete();
    if (!report || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.reportsApi.remove(report.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.selected.set(null);
        this.notice.set(`Laporan “${report.title}” dihapus.`);
        this.load();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.actionError.set(errorMessage(error));
      },
    });
  }

  protected metricsJson(report: Report): string {
    if (!report.metrics || Object.keys(report.metrics).length === 0) {
      return '{}';
    }
    return JSON.stringify(report.metrics, null, 2);
  }

  protected periodLabel(report: Report): string {
    if (!report.period_start && !report.period_end) {
      return 'Tidak ditentukan';
    }
    return `${this.formatPeriod(report.period_start)} – ${this.formatPeriod(report.period_end)}`;
  }

  protected fieldError(name: string, label: string): string | null {
    const control = this.form.get(name);
    if (!control || !control.touched) {
      return null;
    }
    if (control.errors?.['server']) {
      return String(control.errors['server']);
    }
    if (control.errors?.['required']) {
      return `${label} wajib diisi.`;
    }
    if (control.errors?.['minlength']) {
      return `${label} minimal ${control.errors['minlength'].requiredLength} karakter.`;
    }
    if (control.errors?.['maxlength']) {
      return `${label} maksimal ${control.errors['maxlength'].requiredLength} karakter.`;
    }
    if (control.errors?.['metrics']) {
      return 'Metrik harus berupa objek JSON, misalnya {"hadir": 120}.';
    }
    return null;
  }

  protected periodError(): string | null {
    const end = this.form.controls.period_end;
    if (!end.touched || !this.form.hasError('period')) {
      return null;
    }
    return 'Tanggal akhir harus sama atau setelah tanggal mulai.';
  }

  private applyFormError(error: unknown): void {
    if (error instanceof ApiError && error.details) {
      for (const [field, message] of Object.entries(error.details)) {
        const control = this.form.get(field);
        if (control) {
          control.setErrors({ ...(control.errors ?? {}), server: message });
          control.markAsTouched();
        }
      }
    }
    this.formError.set(errorMessage(error));
  }

  private formatPeriod(value: string | null | undefined): string {
    if (!value) {
      return '…';
    }
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateInputToIso(value) : null;
    return iso ? formatShortDate(iso) : value;
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.pendingDelete()) {
      this.cancelDelete();
      return;
    }
    if (this.formOpen()) {
      this.closeForm();
      return;
    }
    if (this.selected()) {
      this.closeDetail();
    }
  }

  protected readonly formatDateTime = formatDateTime;
}

function metricsValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { metrics: true };
    }
  } catch {
    return { metrics: true };
  }
  return null;
}

function periodValidator(group: AbstractControl): ValidationErrors | null {
  const start = dateInputToIso(String(group.get('period_start')?.value ?? ''));
  const end = dateInputToIso(String(group.get('period_end')?.value ?? ''));
  if (start && end && new Date(end) < new Date(start)) {
    return { period: true };
  }
  return null;
}
