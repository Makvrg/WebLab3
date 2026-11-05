import {
  Injectable,
  signal,
  computed,
  Signal,
  inject,
  TransferState,
  makeStateKey,
} from '@angular/core';
import { UserContext } from './user-context.model';
import { SSR_COOKIE } from '../tokens/ssr-cookie.token';
import { extractUserFromToken } from '../utils/jwt.util';

const USER_STATE_KEY = makeStateKey<UserContext | null>('USER_CONTEXT');

function getCookieValue(cookieStr: string, name: string): string | null {
  const match = cookieStr.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly transferState = inject(TransferState);
  private readonly ssrCookie = inject(SSR_COOKIE, { optional: true });

  private readonly _user = signal<UserContext | null>(this.getInitialUser());

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
      if (this.ssrCookie) {
        const token = getCookieValue(this.ssrCookie, 'accessToken');
        const user = extractUserFromToken(token);
        if (user) {
          this.transferState.set(USER_STATE_KEY, user);
          return user;
        }
      }
      return null;
    }

    if (this.transferState.hasKey(USER_STATE_KEY)) {
      const user = this.transferState.get(USER_STATE_KEY, null);
      this.transferState.remove(USER_STATE_KEY);
      if (user) {
        localStorage.setItem('userContext', JSON.stringify(user));
        return user;
      }
    }

    const saved = localStorage.getItem('userContext');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
}
