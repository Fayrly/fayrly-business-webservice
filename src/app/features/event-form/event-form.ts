import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { EventService } from '../../core/api/event.service';
import { HasUnsavedChanges } from '../../core/auth/unsaved-changes.guard';
import { PERMISSIONS } from '../../core/auth/permissions';
import {
  Event,
  EventPayload,
  EventType,
  EVENT_TYPE_LABEL,
} from '../../core/models/event.model';
import { ApiError } from '../../core/models/api-error.model';
import { errorMessage } from '../../core/util/errors';
import {
  formatEventDate,
  formatPriceRange,
  isoToWibInput,
  wibInputToIso,
} from '../../core/util/format';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

type Step = 1 | 2 | 3 | 4;

const STEP_TITLES: { step: Step; label: string }[] = [
  { step: 1, label: 'Info dasar' },
  { step: 2, label: 'Waktu & lokasi' },
  { step: 3, label: 'Tiket' },
  { step: 4, label: 'Tinjau' },
];

const STEP_FIELDS: Record<Step, string[]> = {
  1: ['title', 'type', 'description', 'cover_image_url', 'tags'],
  2: ['starts_at', 'ends_at', 'venue_name', 'venue_address', 'city', 'country'],
  3: ['capacity', 'price_min', 'price_max', 'currency', 'beneficiary', 'donation_target'],
  4: [],
};

@Component({
  selector: 'app-event-form',
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule, ErrorState, StatusBadge],
  templateUrl: './event-form.html',
})
export class EventFormPage implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly eventsApi = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canPublish = this.auth.has(PERMISSIONS.eventPublish);
  protected readonly steps = STEP_TITLES;
  protected readonly typeOptions = Object.entries(EVENT_TYPE_LABEL) as [EventType, string][];

  protected readonly editingId = this.route.snapshot.paramMap.get('id');
  protected readonly isNew = !this.editingId;
  protected readonly step = signal<Step>(1);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly loading = signal(!this.isNew);
  protected readonly loadError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly event = signal<Event | null>(null);
  protected readonly saved = signal(false);
  protected readonly locked = computed(() => {
    const event = this.event();
    return !!event && (event.status === 'completed' || event.status === 'cancelled');
  });

  protected readonly form = this.fb.group(
    {
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      type: ['concert' as EventType, [Validators.required]],
      description: ['', [Validators.maxLength(20000)]],
      cover_image_url: ['', [Validators.maxLength(500), urlValidator]],
      tags: ['', [tagsValidator]],
      venue_name: ['', [Validators.maxLength(200)]],
      venue_address: ['', [Validators.maxLength(500)]],
      city: ['', [Validators.maxLength(120)]],
      country: ['ID', [Validators.pattern(/^[A-Za-z]{2}$/)]],
      starts_at: ['', [Validators.required]],
      ends_at: [''],
      capacity: [0, [Validators.min(0), Validators.max(1000000), integerValidator]],
      price_min: [0, [Validators.min(0)]],
      price_max: [0, [Validators.min(0)]],
      currency: ['IDR', [Validators.pattern(/^[A-Za-z]{3}$/)]],
      organizer_name: ['', [Validators.maxLength(200)]],
      contact_email: ['', [Validators.email, Validators.maxLength(254)]],
      contact_phone: ['', [Validators.maxLength(32)]],
      beneficiary: ['', [Validators.maxLength(200)]],
      donation_target: [0, [Validators.min(0)]],
    },
    { validators: [eventGroupValidator] },
  );

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly isCharity = computed(() => this.formValue().type === 'charity');
  protected readonly formValid = computed(() => this.formStatus() === 'VALID');
  protected readonly preview = computed(() => {
    const value = this.formValue();
    const start = wibInputToIso(value.starts_at);
    const end = wibInputToIso(value.ends_at);
    return {
      title: value.title.trim() || 'Judul event',
      type: EVENT_TYPE_LABEL[value.type] ?? 'Konser',
      date: start ? formatEventDate(start, end) : 'Tanggal belum diisi',
      venue:
        [value.venue_name.trim(), value.city.trim()].filter(Boolean).join(' · ') ||
        'Lokasi belum diisi',
      price: formatPriceRange(
        Number(value.price_min) || 0,
        Number(value.price_max) || 0,
        value.currency || 'IDR',
      ),
      cover: value.cover_image_url.trim(),
      capacity: Number(value.capacity) || 0,
      tags: splitTags(value.tags),
      description: value.description.trim(),
    };
  });

  constructor() {
    if (this.editingId) {
      this.loadEvent(this.editingId);
    }

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.clearServerErrors();
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saved() && !this.locked();
  }

  protected loadEvent(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.eventsApi.get(id).subscribe({
      next: ({ data }) => {
        this.event.set(data);
        this.form.patchValue({
          title: data.title,
          type: data.type,
          description: data.description,
          cover_image_url: data.cover_image_url,
          tags: (data.tags ?? []).join(', '),
          venue_name: data.venue_name,
          venue_address: data.venue_address,
          city: data.city,
          country: data.country || 'ID',
          starts_at: isoToWibInput(data.starts_at),
          ends_at: isoToWibInput(data.ends_at),
          capacity: data.capacity,
          price_min: data.price_min,
          price_max: data.price_max,
          currency: data.currency || 'IDR',
          organizer_name: data.organizer_name,
          contact_email: data.contact_email,
          contact_phone: data.contact_phone,
          beneficiary: data.beneficiary ?? '',
          donation_target: data.donation_target ?? 0,
        });
        this.form.markAsPristine();
        this.saved.set(true);
        const requestedStep = Number(this.route.snapshot.queryParamMap.get('step'));
        if (requestedStep >= 1 && requestedStep <= 4) {
          this.step.set(requestedStep as Step);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected goToStep(step: Step): void {
    if (step < this.step()) {
      this.step.set(step);
    }
  }

  protected nextStep(): void {
    const current = this.step();
    if (current === 4) {
      return;
    }
    if (this.validateStep(current)) {
      this.step.set((current + 1) as Step);
      this.error.set(null);
    } else {
      this.error.set('Periksa kembali isian di langkah ini sebelum melanjutkan.');
    }
  }

  protected previousStep(): void {
    if (this.step() > 1) {
      this.step.set((this.step() - 1) as Step);
    }
  }

  protected reviewForm(): void {
    this.submitted.set(true);
    if (this.form.valid) {
      this.error.set(null);
      return;
    }
    this.jumpToFirstError();
    this.error.set('Lengkapi isian yang ditandai sebelum melanjutkan.');
  }

  protected saveDraft(): void {
    this.persist(false);
  }

  protected publish(): void {
    this.persist(true);
  }

  protected stepValid(step: Step): boolean {
    return this.validateStep(step, false);
  }

  protected canPublishNow(): boolean {
    const event = this.event();
    return (
      this.canPublish &&
      !this.locked() &&
      this.formValid() &&
      (this.isNew || event?.status === 'draft')
    );
  }

  protected errorFor(name: string, label: string): string | null {
    const control = this.form.get(name);
    if (!control || !(control.touched || this.submitted())) {
      return null;
    }
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if (errors['server']) {
      return String(errors['server']);
    }
    if (errors['required']) {
      return `${label} wajib diisi.`;
    }
    if (errors['email']) {
      return 'Format email tidak valid.';
    }
    if (errors['pattern']) {
      return name === 'currency'
        ? 'Gunakan kode mata uang 3 huruf, misalnya IDR.'
        : name === 'country'
          ? 'Gunakan kode negara 2 huruf, misalnya ID.'
          : `${label} tidak valid.`;
    }
    if (errors['minlength']) {
      return `${label} minimal ${errors['minlength'].requiredLength} karakter.`;
    }
    if (errors['maxlength']) {
      return `${label} maksimal ${errors['maxlength'].requiredLength} karakter.`;
    }
    if (errors['min']) {
      return `${label} tidak boleh kurang dari ${errors['min'].min}.`;
    }
    if (errors['max']) {
      return `${label} tidak boleh lebih dari ${errors['max'].max}.`;
    }
    if (errors['url']) {
      return 'Gunakan URL gambar yang lengkap, misalnya https://contoh.com/poster.jpg.';
    }
    if (errors['integer']) {
      return 'Gunakan angka bulat.';
    }
    return `${label} tidak valid.`;
  }

  protected tagsError(): string | null {
    const control = this.form.controls.tags;
    if (!(control.touched || this.submitted()) || !control.hasError('tags')) {
      return null;
    }
    return 'Maksimal 10 tag, masing-masing 1–40 karakter. Pisahkan dengan koma.';
  }

  protected dateRangeError(): string | null {
    const ends = this.form.controls.ends_at;
    if (!(ends.touched || this.submitted()) || !this.form.hasError('dateRange')) {
      return null;
    }
    return 'Waktu selesai harus setelah waktu mulai.';
  }

  protected priceRangeError(): string | null {
    const max = this.form.controls.price_max;
    if (!(max.touched || this.submitted()) || !this.form.hasError('priceRange')) {
      return null;
    }
    return 'Harga maksimum harus lebih besar atau sama dengan harga minimum.';
  }

  protected charityBeneficiaryError(): string | null {
    const control = this.form.controls.beneficiary;
    if (
      !this.isCharity() ||
      !(control.touched || this.submitted()) ||
      !this.form.hasError('charityBeneficiary')
    ) {
      return null;
    }
    return 'Penerima manfaat wajib diisi untuk event amal.';
  }

  protected charityTargetError(): string | null {
    const control = this.form.controls.donation_target;
    if (
      !this.isCharity() ||
      !(control.touched || this.submitted()) ||
      !this.form.hasError('charityTarget')
    ) {
      return null;
    }
    return 'Target donasi harus lebih dari 0 untuk event amal.';
  }

  protected acceptCharity(): string {
    return this.isCharity() ? 'wajib' : 'opsional';
  }

  private validateStep(step: Step, mark = true): boolean {
    const fields = STEP_FIELDS[step];
    if (mark) {
      fields.forEach((field) => this.form.get(field)?.markAsTouched());
    }
    const controlsValid = fields.every((field) => this.form.get(field)?.valid ?? true);
    const groupValid =
      step === 2
        ? !this.form.hasError('dateRange')
        : step === 3
          ? !this.form.hasError('priceRange') &&
            !this.form.hasError('charityBeneficiary') &&
            !this.form.hasError('charityTarget')
          : true;
    return controlsValid && groupValid;
  }

  private jumpToFirstError(): void {
    for (const step of [1, 2, 3, 4] as Step[]) {
      if (!this.validateStep(step)) {
        this.step.set(step);
        return;
      }
    }
  }

  private persist(publish: boolean): void {
    if (this.saving() || this.locked()) {
      return;
    }
    this.submitted.set(true);
    this.error.set(null);

    if (!this.form.valid) {
      this.jumpToFirstError();
      this.error.set('Lengkapi isian yang ditandai sebelum menyimpan event.');
      return;
    }

    this.saving.set(true);
    const payload = this.buildPayload();
    const request = this.editingId
      ? this.eventsApi.update(this.editingId, payload)
      : this.eventsApi.create(payload);

    request
      .pipe(
        switchMap((response) => {
          if (!publish) {
            return of({ event: response.data, published: false });
          }
          return this.eventsApi
            .changeStatus(response.data.id, 'published')
            .pipe(
              switchMap((published) => of({ event: published.data, published: true })),
            );
        }),
      )
      .subscribe({
        next: ({ event, published }) => {
          this.saving.set(false);
          this.saved.set(true);
          this.form.markAsPristine();
          this.router.navigate(['/events', event.id], {
            queryParams: { state: published ? 'published' : 'draft' },
          });
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.applyServerErrors(error);
        },
      });
  }

  private buildPayload(): EventPayload {
    const value = this.form.getRawValue();
    return {
      title: value.title.trim(),
      type: value.type,
      description: value.description.trim(),
      cover_image_url: value.cover_image_url.trim(),
      organizer_name: value.organizer_name.trim(),
      contact_email: value.contact_email.trim(),
      contact_phone: value.contact_phone.trim(),
      tags: splitTags(value.tags),
      starts_at: wibInputToIso(value.starts_at) ?? '',
      ends_at: wibInputToIso(value.ends_at),
      venue_name: value.venue_name.trim(),
      venue_address: value.venue_address.trim(),
      city: value.city.trim(),
      country: value.country.trim().toUpperCase() || 'ID',
      capacity: Number(value.capacity) || 0,
      price_min: Number(value.price_min) || 0,
      price_max: Number(value.price_max) || 0,
      currency: value.currency.trim().toUpperCase() || 'IDR',
      beneficiary: value.beneficiary.trim(),
      donation_target: Number(value.donation_target) || 0,
    };
  }

  private applyServerErrors(error: unknown): void {
    if (error instanceof ApiError && error.details) {
      let firstStep: Step | null = null;
      for (const [field, message] of Object.entries(error.details)) {
        const control = this.form.get(field);
        if (!control) {
          continue;
        }
        control.setErrors({ ...(control.errors ?? {}), server: message });
        control.markAsTouched();
        const step = stepFor(field);
        if (step && (!firstStep || step < firstStep)) {
          firstStep = step;
        }
      }
      if (firstStep) {
        this.step.set(firstStep);
      }
    }
    this.error.set(errorMessage(error));
  }

  private clearServerErrors(): void {
    Object.values(this.form.controls).forEach((control) => {
      const errors = control.errors;
      if (errors && errors['server']) {
        const { server, ...rest } = errors;
        control.setErrors(Object.keys(rest).length ? rest : null);
      }
    });
  }

  protected readonly formatEventDate = formatEventDate;
}

function stepFor(field: string): Step | null {
  for (const step of [1, 2, 3, 4] as Step[]) {
    if (STEP_FIELDS[step].includes(field)) {
      return step;
    }
  }
  if (field === 'starts_at') {
    return 2;
  }
  return null;
}

function splitTags(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function urlValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }
  return /^https?:\/\/\S+$/i.test(value) ? null : { url: true };
}

function tagsValidator(control: AbstractControl): ValidationErrors | null {
  const tags = splitTags(String(control.value ?? ''));
  if (tags.length > 10 || tags.some((tag) => tag.length > 40)) {
    return { tags: true };
  }
  return null;
}

function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value = Number(control.value);
  if (control.value === '' || control.value === null) {
    return null;
  }
  return Number.isInteger(value) ? null : { integer: true };
}

function eventGroupValidator(group: AbstractControl): ValidationErrors | null {
  const errors: ValidationErrors = {};
  const start = wibInputToIso(String(group.get('starts_at')?.value ?? ''));
  const end = wibInputToIso(String(group.get('ends_at')?.value ?? ''));
  if (start && end && new Date(end) <= new Date(start)) {
    errors['dateRange'] = true;
  }
  const min = Number(group.get('price_min')?.value) || 0;
  const max = Number(group.get('price_max')?.value) || 0;
  if (max !== 0 && max < min) {
    errors['priceRange'] = true;
  }
  if (group.get('type')?.value === 'charity') {
    if (!String(group.get('beneficiary')?.value ?? '').trim()) {
      errors['charityBeneficiary'] = true;
    }
    if ((Number(group.get('donation_target')?.value) || 0) <= 0) {
      errors['charityTarget'] = true;
    }
  }
  return Object.keys(errors).length ? errors : null;
}
