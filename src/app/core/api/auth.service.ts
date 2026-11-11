import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, defer, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import {
  ChangePasswordRequest,
  LoginRequest,
  Profile,
  ResetPasswordCodeRequest,
  Session,
  SessionUser,
  VerifyResetCodeRequest,
} from '../models/auth.model';

const TOKEN_KEY = 'fayrly.access_token';
const REFRESH_KEY = 'fayrly.refresh_token';
const USER_KEY = 'fayrly.user';

function normalizeUser(user: SessionUser): SessionUser {
  return {
    ...user,
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly userSignal = signal<SessionUser | null>(this.readUser());
  private readonly tokenSignal = signal<string | null>(this.readValue(TOKEN_KEY));
  private refresh$: Observable<Session> | null = null;

  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly displayName = computed(() => this.userSignal()?.name ?? '');

  get accessToken(): string | null {
    return this.tokenSignal();
  }

  get refreshToken(): string | null {
    return this.readValue(REFRESH_KEY);
  }

  has(permission: string): boolean {
    return (this.userSignal()?.permissions ?? []).includes(permission);
  }

  hasAny(permissions: readonly string[]): boolean {
    return permissions.some((permission) => this.has(permission));
  }

  login(credentials: LoginRequest, remember = true): Observable<Session> {
    return this.http
      .post<Session>('/auth/login', credentials)
      .pipe(tap((session) => this.store(session, remember)));
  }

  loadProfile(): Observable<Profile> {
    return this.http.get<{ user: Profile }>('/auth/me').pipe(
      map(({ user }) => {
        this.writeUser(user);
        return user;
      }),
    );
  }

  changePassword(payload: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>('/auth/password', payload);
  }

  requestPasswordReset(email: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>('/auth/password/forgot', { email });
  }

  verifyPasswordResetCode(payload: VerifyResetCodeRequest): Observable<void> {
    return this.http.post<void>('/auth/password/verify', payload);
  }

  resetPasswordWithCode(payload: ResetPasswordCodeRequest): Observable<void> {
    return this.http.post<void>('/auth/password/reset', payload);
  }

  refreshSession(): Observable<Session> {
    if (this.refresh$) {
      return this.refresh$;
    }
    const request$ = defer(() => {
      const token = this.refreshToken;
      if (!token) {
        return throwError(() => new Error('No refresh token available'));
      }
      return this.http.post<Session>('/auth/refresh', { refresh_token: token });
    }).pipe(
      tap((session) => this.store(session, this.isPersistent())),
      finalize(() => {
        this.refresh$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refresh$ = request$;
    return request$;
  }

  logout(): void {
    const refreshToken = this.refreshToken;
    if (refreshToken) {
      this.http
        .post<void>('/auth/logout', { refresh_token: refreshToken })
        .subscribe({ error: () => undefined });
    }
    this.clearSession();
  }

  clearSession(): void {
    this.removeValue(TOKEN_KEY);
    this.removeValue(REFRESH_KEY);
    this.removeValue(USER_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }

  private store(session: Session, remember: boolean): void {
    this.writeValue(TOKEN_KEY, session.access_token, remember);
    this.writeValue(REFRESH_KEY, session.refresh_token, remember);
    this.writeUser(session.user, remember);
    this.tokenSignal.set(session.access_token);
  }

  private writeUser(user: SessionUser, remember = this.isPersistent()): void {
    const normalized = normalizeUser(user);
    this.writeValue(USER_KEY, JSON.stringify(normalized), remember);
    this.userSignal.set(normalized);
  }

  private isPersistent(): boolean {
    try {
      return localStorage.getItem(TOKEN_KEY) !== null;
    } catch {
      return false;
    }
  }

  private readUser(): SessionUser | null {
    const raw = this.readValue(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return normalizeUser(JSON.parse(raw) as SessionUser);
    } catch {
      return null;
    }
  }

  private readValue(key: string): string | null {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeValue(key: string, value: string, remember: boolean): void {
    try {
      const target = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      target.setItem(key, value);
      other.removeItem(key);
    } catch {
      // Storage can be unavailable in private browsing; the in-memory session still works.
    }
  }

  private removeValue(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage failures on sign-out.
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage failures on sign-out.
    }
  }
}
