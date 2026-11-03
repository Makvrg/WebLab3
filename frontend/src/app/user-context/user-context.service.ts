import { Injectable, signal, computed, Signal } from '@angular/core';
import { UserContext } from './user-context.model';
import { extractUserFromToken } from '../utils/jwt.util';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly _user = signal<UserContext | null>(
    extractUserFromToken(localStorage.getItem('accessToken'))
  );

  readonly user: Signal<UserContext | null> = this._user.asReadonly();

  readonly isAuthenticated: Signal<boolean> = computed(() => {
    const userContext: UserContext | null = this._user();

    return !!(
      userContext &&
      userContext.login &&
      userContext.role
    );
  });

  readonly isAdmin: Signal<boolean> = computed(() => {
    return this._user()?.role === 'ADMIN';
  });

  setUser(user: UserContext | null): void {
    this._user.set(user);
  }

  clearUser(): void {
    this._user.set(null);
  }
}
