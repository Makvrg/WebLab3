import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable, catchError, finalize,
  map, shareReplay, tap, throwError
} from 'rxjs';
import { AUTH_URL } from './api.constants';
import { Role } from '../entity/Role';
import { UserContextService } from '../user-context/user-context.service';
import { UserContext } from '../user-context/user-context.model';

export interface TokenResponse {
  accessToken: string;
  refreshTokenId: string;
  refreshToken: string;
  role: Role;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private refreshRequest$?: Observable<string>;
  private userContextService: UserContextService = inject(UserContextService);

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  login(login: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      `${AUTH_URL}/login`,
      { login, password }
    ).pipe(tap(tokens => this.saveTokensAndContext(tokens)));
  }

  register(userData: object): Observable<unknown> {
    return this.http.post(`${AUTH_URL}/register`, userData);
  }

  refreshTokens(): Observable<string> {
    const refreshTokenId = localStorage.getItem('refreshTokenId');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshTokenId || !refreshToken) {
      this.clearTokensAndContext();
      return throwError(() => new Error('Refresh-токен отсутствует'));
    }

    if (!this.refreshRequest$) {
      this.refreshRequest$ = this.http
        .post<TokenResponse>(`${AUTH_URL}/refresh`, {
          refreshTokenId,
          refreshToken
        })
        .pipe(
          tap(tokens => this.saveTokensAndContext(tokens)),
          map(tokens => tokens.accessToken),
          catchError(error => {
            this.clearTokensAndContext();
            return throwError(() => error);
          }),
          finalize(() => {
            this.refreshRequest$ = undefined;
          }),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }

    return this.refreshRequest$;
  }

  logout(): Observable<void> {
    const body = {
      accessToken: this.getAccessToken(),
      refreshTokenId: localStorage.getItem('refreshTokenId'),
      refreshToken: localStorage.getItem('refreshToken')
    };

    return this.http.post<void>(
      `${AUTH_URL}/logout`,
      body
    ).pipe(finalize(() => this.clearTokensAndContext()));
  }

  private clearTokensAndContext(): void {
    for (const key of [
      'accessToken', 'refreshTokenId', 'refreshToken'
    ]) {
      localStorage.removeItem(key);
    }
    this.userContextService.clearUser()
  }

  private saveTokensAndContext(tokens: TokenResponse): void {
    const userIdAndLogin: { userId: number; login: string } | null =
      this.extractUserFromToken(tokens.accessToken);
    if (
      !tokens?.accessToken ||
      !tokens?.refreshTokenId ||
      !tokens?.refreshToken
    ) {
      throw new Error('Сервер вернул неполный набор токенов');
    }
    if (userIdAndLogin === null) {
      throw new Error('Сервер вернул некорректный токен');
    }

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshTokenId', tokens.refreshTokenId);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    const userContext: UserContext = {
      userId: userIdAndLogin.userId,
      login: userIdAndLogin.login,
      role: tokens.role
    };
    this.userContextService.setUser(userContext);
  }

  private extractUserFromToken(
    token: string | null = this.getAccessToken()
  ): { userId: number; login: string } | null {
    if (!token) {
      return null;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      base64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');

      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const payload = JSON.parse(jsonPayload);
      if (payload?.userId === undefined || !payload?.login) {
        return null;
      }

      return {
        userId: Number(payload.userId),
        login: String(payload.login)
      };
    } catch {
      return null;
    }
  }
}
