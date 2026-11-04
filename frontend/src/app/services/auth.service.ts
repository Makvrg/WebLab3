import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';
import { AUTH_URL } from './api.constants';
import { UserContextService } from '../user-context/user-context.service';
import { UserContext } from '../user-context/user-context.model';

interface AuthResponse {
  user: UserContext;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userContextService = inject(UserContextService);

  login(login: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${AUTH_URL}/login`, { login, password }).pipe(
      tap((res) => this.userContextService.setUser(res.user))
    );
  }

  register(userData: object): Observable<unknown> {
    return this.http.post(`${AUTH_URL}/register`, userData);
  }

  refreshTokens(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${AUTH_URL}/refresh`, {}).pipe(
      tap((res) => this.userContextService.setUser(res.user))
    );
  }

  logout(): Observable<unknown> {
    return this.http.post(`${AUTH_URL}/logout`, {}).pipe(
      finalize(() => this.userContextService.clearUser())
    );
  }
}
