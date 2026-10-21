import { Injectable } from '@angular/core';
import { UserContext } from './user-context.model';

@Injectable({
  providedIn: 'root',
})
export class UserContextService {
  private _user: UserContext | null = null;

  get user(): UserContext | null {
    return this._user;
  }

  set user(value: UserContext | null) {
    this._user = value;
  }
}
