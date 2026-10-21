import {Injectable, signal, computed, Signal} from '@angular/core';
import { UserContext } from './user-context.model';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly _user = signal<UserContext | null>(null);

  readonly user: Signal<UserContext | null> = this._user.asReadonly();

  readonly isAuthenticated: Signal<boolean> = computed(() => {
    const userContext: UserContext | null = this._user();

    return !!(
      userContext &&
      userContext.login &&
      userContext.role
    );
  });

  setUser(user: UserContext | null): void {
    this._user.set(user);
  }

  clearUser(): void {
    this._user.set(null);
  }
}
