import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../api/auth.service';

const RETRIED = new HttpContextToken<boolean>(() => false);

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/firebase',
  '/auth/refresh',
  '/auth/logout',
  '/auth/password/forgot',
  '/auth/password/verify',
  '/auth/password/reset',
];

function isPublicAuth(url: string): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => url.startsWith(path));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.accessToken;
  const outgoing =
    token && !isPublicAuth(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isPublicAuth(req.url) ||
        req.context.get(RETRIED)
      ) {
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        switchMap((session) =>
          next(
            req.clone({
              context: req.context.set(RETRIED, true),
              setHeaders: { Authorization: `Bearer ${session.access_token}` },
            }),
          ),
        ),
        catchError((refreshError: unknown) => {
          auth.clearSession();
          if (!router.url.startsWith('/masuk')) {
            router.navigate(['/masuk'], { queryParams: { returnUrl: router.url } });
          }
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
