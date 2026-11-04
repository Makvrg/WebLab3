import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  const isAuthEndpoint = req.url.includes('/auth/');

  const targetReq = !isBrowser && req.url.startsWith('/')
    ? req.clone({ url: `http://localhost:3000${req.url}` })
    : req;

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
          router.navigate(['/login']);
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
