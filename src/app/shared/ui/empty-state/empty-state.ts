import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-empty-state',
  imports: [LucideAngularModule],
  template: `
    <div
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-mint-50 text-mint-700">
        <lucide-icon [name]="icon()" class="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 class="mt-4 text-base font-semibold text-slate-900">{{ title() }}</h3>
      <p class="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{{ message() }}</p>
      @if (actionLabel(); as label) {
        <button type="button" class="btn-secondary mt-5" (click)="action.emit()">
          {{ label }}
        </button>
      }
    </div>
  `,
})
export class EmptyState {
  readonly title = input('Belum ada data');
  readonly message = input('Data akan muncul di sini setelah tersedia.');
  readonly actionLabel = input<string | null>(null);
  readonly icon = input('inbox');
  readonly action = output<void>();
}
