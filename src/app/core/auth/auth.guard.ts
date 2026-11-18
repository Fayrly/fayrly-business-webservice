import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../api/auth.service';
import { isOrganizer, hasAnyPermission } from './permissions';

function loginTree(router: Router): UrlTree {
  return router.createUrlTree(['/masuk'], { queryParams: { returnUrl: router.url } });
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() && auth.accessToken ? true : loginTree(router);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/ringkasan']) : true;
};

export const landingMatch: CanMatchFn = () => !inject(AuthService).isAuthenticated();

export const organizerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return loginTree(router);
  }
  return isOrganizer(auth.user()) ? true : router.createUrlTree(['/tanpa-akses']);
};

export function permissionGuard(permissions: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return loginTree(router);
    }
    return hasAnyPermission(auth.user(), permissions)
      ? true
      : router.createUrlTree(['/tanpa-akses']);
  };
}
