import { Injectable, signal, computed, Signal } from '@angular/core';
import { UserContext } from './user-context.model';
import { Role } from '../entity/Role';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly _user = signal<UserContext | null>(this.restoreFromToken());

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

  private restoreFromToken(): UserContext | null {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return null;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      base64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');

      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const payload = JSON.parse(jsonPayload);
      if (payload?.userId === undefined || !payload?.login || !payload?.role) {
        return null;
      }

      return {
        userId: Number(payload.userId),
        login: String(payload.login),
        role: payload.role as Role,
      };
    } catch {
      return null;
    }
  }
}
