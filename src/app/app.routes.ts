import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  landingMatch,
  organizerGuard,
  permissionGuard,
} from './core/auth/auth.guard';
import { PERMISSIONS } from './core/auth/permissions';
import { unsavedChangesGuard } from './core/auth/unsaved-changes.guard';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: '',
    canMatch: [landingMatch],
    title: 'Fayrly untuk Penyelenggara',
    loadComponent: () => import('./features/landing/landing').then((m) => m.LandingPage),
  },
  {
    path: 'masuk',
    title: 'Masuk',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'lupa-password',
    title: 'Lupa kata sandi',
    loadComponent: () =>
      import('./features/forgot-password/forgot-password').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'tanpa-akses',
    title: 'Belum punya akses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/no-access/no-access').then((m) => m.NoAccessPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard, organizerGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ringkasan' },
      {
        path: 'ringkasan',
        title: 'Ringkasan',
        loadComponent: () =>
          import('./features/overview/overview').then((m) => m.OverviewPage),
      },
      {
        path: 'events',
        title: 'Event Saya',
        canActivate: [permissionGuard([PERMISSIONS.eventRead])],
        loadComponent: () =>
          import('./features/events/events').then((m) => m.EventsPage),
      },
      {
        path: 'events/baru',
        title: 'Buat Event',
        canActivate: [permissionGuard([PERMISSIONS.eventWrite])],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/event-form/event-form').then((m) => m.EventFormPage),
      },
      {
        path: 'events/:id/ubah',
        title: 'Ubah Event',
        canActivate: [permissionGuard([PERMISSIONS.eventWrite])],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/event-form/event-form').then((m) => m.EventFormPage),
      },
      {
        path: 'events/:id',
        title: 'Detail Event',
        canActivate: [permissionGuard([PERMISSIONS.eventRead])],
        loadComponent: () =>
          import('./features/event-detail/event-detail').then((m) => m.EventDetailPage),
      },
      {
        path: 'jadwal',
        title: 'Jadwal',
        canActivate: [permissionGuard([PERMISSIONS.eventRead])],
        loadComponent: () =>
          import('./features/schedule/schedule').then((m) => m.SchedulePage),
      },
      {
        path: 'harga',
        title: 'Harga & Promo',
        canActivate: [permissionGuard([PERMISSIONS.eventRead])],
        loadComponent: () =>
          import('./features/pricing/pricing').then((m) => m.PricingPage),
      },
      {
        path: 'ulasan',
        title: 'Ulasan',
        canActivate: [permissionGuard([PERMISSIONS.eventRead])],
        loadComponent: () =>
          import('./features/reviews/reviews').then((m) => m.ReviewsPage),
      },
      {
        path: 'laporan',
        title: 'Laporan',
        canActivate: [permissionGuard([PERMISSIONS.reportRead])],
        loadComponent: () =>
          import('./features/reports/reports').then((m) => m.ReportsPage),
      },
      {
        path: 'akun',
        title: 'Akun',
        loadComponent: () =>
          import('./features/account/account').then((m) => m.AccountPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
