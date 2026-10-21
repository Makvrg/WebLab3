import { Injectable, computed, signal } from '@angular/core';
import { UserContext } from './user-context.model';

@Injectable({
  providedIn: 'root',
})
export class UserContextService {
  private readonly _userSignal = signal<UserContext | null>(this.restoreSession());

  readonly user$ = this._userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this._userSignal() !== null);
  readonly userRole = computed(() => this._userSignal()?.role ?? null);
  readonly isAdmin = computed(() => this._userSignal()?.role === 'ADMIN');
  readonly currentLogin = computed(() => this._userSignal()?.login ?? '');

  get user(): UserContext | null {
    return this._userSignal();
  }

  set user(value: UserContext | null) {
    this._userSignal.set(value);
    if (value) {
      localStorage.setItem('userContext', JSON.stringify(value));
    } else {
      localStorage.removeItem('userContext');
    }
  }

  clear(): void {
    this.user = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('refreshTokenId');
  }

  private restoreSession(): UserContext | null {
    const raw = localStorage.getItem('userContext');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
