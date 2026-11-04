import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable, catchError, finalize,
  map, shareReplay, tap, throwError, of
} from 'rxjs';
import { AUTH_URL } from './api.constants';
import { UserContextService } from '../user-context/user-context.service';
import { UserContext } from '../user-context/user-context.model';
import { extractUserFromToken } from '../utils/jwt.util';
import { setCookie, getCookie, removeCookie } from '../utils/cookie.util';

export interface TokenResponse {
  accessToken: string;
  refreshTokenId: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userContextService = inject(UserContextService);
  private refreshRequest$?: Observable<string>;

  getAccessToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem('accessToken') || getCookie('accessToken');
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
    if (typeof window === 'undefined') {
      return throwError(() => new Error('Обновление токена невозможно на сервере'));
    }

    const refreshTokenId = Number(localStorage.getItem('refreshTokenId'));
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
    if (typeof window === 'undefined') {
      this.clearTokensAndContext();
      return of(undefined);
    }

    const body = {
      refreshTokenId: Number(localStorage.getItem('refreshTokenId')),
      refreshToken: localStorage.getItem('refreshToken')
    };

    return this.http.post<void>(
      `${AUTH_URL}/logout`,
      body
    ).pipe(finalize(() => this.clearTokensAndContext()));
  }

  private clearTokensAndContext(): void {
    if (typeof window !== 'undefined') {
      for (const key of ['accessToken', 'refreshTokenId', 'refreshToken']) {
        localStorage.removeItem(key);
      }
    }
    removeCookie('accessToken');
    this.userContextService.clearUser();
  }

  private saveTokensAndContext(tokens: TokenResponse): void {
    if (
      !tokens?.accessToken ||
      !tokens?.refreshTokenId ||
      !tokens?.refreshToken
    ) {
      throw new Error('Сервер вернул неполный набор токенов');
    }

    const userContext: UserContext | null = extractUserFromToken(tokens.accessToken);
    if (userContext === null) {
      throw new Error('Сервер вернул некорректный токен');
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshTokenId', String(tokens.refreshTokenId));
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
    setCookie('accessToken', tokens.accessToken, 7);

    this.userContextService.setUser(userContext);
  }
}
