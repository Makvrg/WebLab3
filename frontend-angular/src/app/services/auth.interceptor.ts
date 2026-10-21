import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { AUTH_URL } from './api.constants';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const authBase = new URL(AUTH_URL);
  const authPath: string = authBase.pathname.replace(/\/+$/, '');

  let requestUrl: URL;

  try {
    requestUrl = new URL(req.url, authBase.origin);
  } catch {
    return next(req);
  }

  if (requestUrl.origin !== authBase.origin) {
    return next(req);
  }

  const requestPath: string = requestUrl.pathname.replace(/\/+$/, '');

  const isAuthEndpoint: boolean =
    requestPath === authPath ||
    requestPath.startsWith(`${authPath}/`);

  const skipBearer: boolean = [
    `${authPath}/login`,
    `${authPath}/register`,
    `${authPath}/refresh`,
    `${authPath}/logout`
  ].includes(requestPath);

  const accessToken: string | null = auth.getAccessToken();

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
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isAuthEndpoint
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
