import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, InjectionToken } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const SSR_COOKIE = new InjectionToken<string>('SSR_COOKIE');

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  const ssrCookie = !isBrowser ? inject(SSR_COOKIE, { optional: true }) : null;

  const isAuthEndpoint = req.url.includes('/auth/');

  let targetReq = req;
  if (!isBrowser && req.url.startsWith('/')) {
    const headers: Record<string, string> = {};
    if (ssrCookie) {
      headers['cookie'] = String(ssrCookie);
    }
    targetReq = req.clone({
      url: `http://localhost:3000${req.url}`,
      setHeaders: headers,
    });
  }

  return next(targetReq).pipe(
    catchError((error: unknown) => {
      if (
        !isBrowser ||
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isAuthEndpoint
      ) {
        return throwError(() => error);
      }

      return auth.refreshTokens().pipe(
        switchMap(() => next(targetReq)),
        catchError((refreshErr) => {
          auth.logout().subscribe();
          void router.navigate(['/login']);
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
