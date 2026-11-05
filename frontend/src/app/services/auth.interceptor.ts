import {
  HttpErrorResponse, HttpEvent, HttpHandlerFn,
  HttpInterceptorFn, HttpRequest
} from '@angular/common/http';
import { inject, PLATFORM_ID, InjectionToken } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import {catchError, Observable, switchMap, throwError} from 'rxjs';
import { AuthService } from './auth.service';

export const SSR_COOKIE: InjectionToken<string> = new InjectionToken<string>('SSR_COOKIE');

export const authInterceptor: HttpInterceptorFn =
  (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
    const auth: AuthService = inject(AuthService);
    const router: Router = inject(Router);
    const isBrowser: boolean = isPlatformBrowser(inject(PLATFORM_ID));

    const ssrCookie: string | null = !isBrowser ? inject(SSR_COOKIE, { optional: true }) : null;

    const isAuthEndpoint: boolean = req.url.includes('/auth/');

    let targetReq: HttpRequest<unknown> = req;
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
      catchError((error: unknown): Observable<HttpEvent<unknown>> => {
        if (
          !isBrowser ||
          !(error instanceof HttpErrorResponse) ||
          error.status !== 401 ||
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
