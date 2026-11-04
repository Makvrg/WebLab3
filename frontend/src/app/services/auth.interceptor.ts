import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  const origin = isBrowser ? window.location.origin : 'http://localhost:3000';

  let requestUrl: URL;
  try {
    requestUrl = new URL(req.url, origin);
  } catch {
    return next(req);
  }

  const requestPath = requestUrl.pathname.replace(/\/+$/, '');

  const skipBearer = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout'
  ].some(endpoint => requestPath.endsWith(endpoint));

  const accessToken = auth.getAccessToken();

  const authReq = accessToken && !skipBearer
    ? req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        !isBrowser ||
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        skipBearer
      ) {
        return throwError(() => error);
      }

      return auth.refreshTokens().pipe(
        switchMap(newAccessToken =>
          next(req.clone({
            setHeaders: {
              Authorization: `Bearer ${newAccessToken}`
            }
          }))
        )
      );
    })
  );
};
