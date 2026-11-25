import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SSR_COOKIE } from '../tokens/ssr-cookie.token';

export { SSR_COOKIE };

const SSR_SELF_ORIGIN = 'http://localhost:3000';
const RT_API_PREFIX = '/api/rt';
const AUTH_PATH_SEGMENT = '/auth/';
const HTTP_UNAUTHORIZED = 401;

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth: AuthService = inject(AuthService);
  const router: Router = inject(Router);
  const isBrowser: boolean = isPlatformBrowser(inject(PLATFORM_ID));

  const ssrCookie: string | null = !isBrowser ? inject(SSR_COOKIE, { optional: true }) : null;

  const isAuthEndpoint: boolean = req.url.includes(AUTH_PATH_SEGMENT);

  let targetReq: HttpRequest<unknown> = req;
  if (!isBrowser && req.url.startsWith('/')) {
    const headers: Record<string, string> = {};
    if (ssrCookie) {
      headers['cookie'] = String(ssrCookie);
    }

    let baseTargetUrl = SSR_SELF_ORIGIN;
    if (req.url.startsWith(RT_API_PREFIX)) {
      const nodeBackendUrl: string | undefined =
        typeof process !== 'undefined' ? process.env['NODE_BACKEND_URL'] : undefined;
      if (!nodeBackendUrl || nodeBackendUrl.trim().length === 0) {
        throw new Error('NODE_BACKEND_URL не задан в переменных окружения');
      }
      baseTargetUrl = nodeBackendUrl.trim().replace(/\/+$/, '');
    }

    targetReq = req.clone({
      url: `${baseTargetUrl}${req.url}`,
      setHeaders: headers,
    });
  }

  return next(targetReq).pipe(
    catchError((error: unknown): Observable<HttpEvent<unknown>> => {
      if (
        !isBrowser ||
        !(error instanceof HttpErrorResponse) ||
        error.status !== HTTP_UNAUTHORIZED ||
        isAuthEndpoint
      ) {
        return throwError((): unknown => error);
      }

      return auth.refreshTokens().pipe(
        switchMap((): Observable<HttpEvent<unknown>> => next(targetReq)),
        catchError((refreshErr): Observable<never> => {
          auth.logout().subscribe();
          void router.navigate(['/login']);
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
