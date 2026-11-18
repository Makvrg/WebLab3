import { H3Event, EventHandlerRequest, setCookie, deleteCookie } from 'h3';
import { Buffer } from 'node:buffer';
import { Role } from '../../app/entity/Role';

export interface AuthTokensPayload {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: number | string;
}

export interface SessionUser {
  userId: number;
  login: string;
  role: Role;
}

export function setAuthCookiesAndExtractUser(
  event: H3Event<EventHandlerRequest>,
  tokens: AuthTokensPayload
): { user: SessionUser } {
  const payloadBase64: string = tokens.accessToken.split('.')[1];
  const payloadJson: string = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
  const payload = JSON.parse(payloadJson);

  setCookie(event, 'accessToken', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  });

  setCookie(event, 'refreshToken', tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  setCookie(event, 'refreshTokenId', String(tokens.refreshTokenId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return {
    user: {
      userId: Number(payload.userId),
      login: String(payload.login),
      role: payload.role as Role,
    },
  };
}

export function clearAuthCookies(event: H3Event<EventHandlerRequest>): void {
  deleteCookie(event, 'accessToken', { path: '/' });
  deleteCookie(event, 'refreshToken', { path: '/' });
  deleteCookie(event, 'refreshTokenId', { path: '/' });
}
