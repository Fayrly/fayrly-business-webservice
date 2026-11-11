import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-error-state',
  imports: [LucideAngularModule],
  template: `
    <div
      class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center"
      role="alert"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
        <lucide-icon name="triangle-alert" class="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-slate-900">Gagal memuat data</h3>
      <p class="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{{ message() }}</p>
      <button type="button" class="btn-primary mt-5" (click)="retry.emit()">
        <lucide-icon name="refresh-cw" class="h-4 w-4" aria-hidden="true" />
        Coba lagi
      </button>
    </div>
  `,
})
export class ErrorState {
  readonly message = input('Terjadi kesalahan saat memuat data.');
  readonly retry = output<void>();
}
