import {Injectable, signal, computed, Signal, WritableSignal} from '@angular/core';
import { UserContext } from './user-context.model';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly _user: WritableSignal<UserContext | null> =
    signal<UserContext | null>(this.getInitialUser());

  readonly user: Signal<UserContext | null> = this._user.asReadonly();

  readonly isAuthenticated: Signal<boolean> = computed((): boolean => {
    const u: UserContext | null = this._user();
    return !!(u && u.login && u.role);
  });

  readonly isAdmin: Signal<boolean> = computed((): boolean => {
    return this._user()?.role === 'ADMIN';
  });

  setUser(user: UserContext | null): void {
    this._user.set(user);
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('userContext', JSON.stringify(user));
      } else {
        localStorage.removeItem('userContext');
      }
    }
  }

  clearUser(): void {
    this.setUser(null);
  }

  private getInitialUser(): UserContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const saved: string | null = localStorage.getItem('userContext');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
}
