import { Component, HostListener, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-confirm-dialog',
  imports: [LucideAngularModule],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
        role="presentation"
        (click)="cancel.emit()"
      >
        <div
          class="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-card sm:rounded-xl"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-title'"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              [class]="
                danger()
                  ? 'bg-crimson-50 text-crimson-600'
                  : 'bg-mint-50 text-mint-700'
              "
            >
              <lucide-icon
                [name]="danger() ? 'triangle-alert' : 'circle-help'"
                class="h-5 w-5"
                aria-hidden="true"
              />
            </span>
            <div class="min-w-0">
              <h2 id="confirm-title" class="text-base font-semibold text-slate-900">
                {{ title() }}
              </h2>
              <p class="mt-1 text-sm leading-relaxed text-slate-600">{{ message() }}</p>
            </div>
          </div>

          @if (requireText(); as expected) {
            <label class="mt-4 block">
              <span class="field-label">
                Ketik <span class="font-semibold text-slate-900">{{ expected }}</span> untuk
                melanjutkan
              </span>
              <input
                class="field"
                [value]="typed()"
                (input)="onTyped($event)"
                [attr.aria-label]="'Ketik ' + expected + ' untuk konfirmasi'"
                autocomplete="off"
              />
            </label>
          }

          <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="btn-secondary" (click)="cancel.emit()" [disabled]="busy()">
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              [class]="danger() ? 'btn-danger' : 'btn-primary'"
              (click)="confirm.emit()"
              [disabled]="busy() || !canConfirm()"
            >
              @if (busy()) {
                <lucide-icon name="loader-circle" class="h-4 w-4 animate-spin" aria-hidden="true" />
              }
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input('Konfirmasi tindakan');
  readonly message = input('');
  readonly confirmLabel = input('Lanjutkan');
  readonly cancelLabel = input('Batal');
  readonly danger = input(true);
  readonly busy = input(false);
  readonly requireText = input<string | null>(null);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  protected readonly typed = signal('');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.typed.set('');
      }
    });
  }

  protected canConfirm(): boolean {
    const expected = this.requireText();
    return !expected || this.typed() === expected;
  }

  protected onTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) {
      this.cancel.emit();
    }
  }
}
