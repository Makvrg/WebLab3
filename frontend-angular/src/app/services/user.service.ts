import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { USERS_URL } from './api.constants';
import { UserProfile } from '../entity/UserProfile';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  getUser (id: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(
      `${USERS_URL}/${encodeURIComponent(id)}`
    );
  }
}
