import {
  H3Event,
  EventHandlerRequest,
  setCookie,
  deleteCookie,
  getRequestHeader,
} from 'h3';
import { Buffer } from 'node:buffer';
import { Role } from '../../app/entity/Role';

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const COOKIE_PATH = '/';
const HTTPS_PROTO = 'https';

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

function isHttpsRequest(event: H3Event<EventHandlerRequest>): boolean {
  const rawForwardedProto =
    getRequestHeader(event, 'x-forwarded-proto') ??
    event.node.req.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(rawForwardedProto)
    ? rawForwardedProto[0]
    : rawForwardedProto;

  if (typeof forwardedProto === 'string') {
    const firstProto = forwardedProto.split(',')[0]?.trim().toLowerCase();
    if (firstProto === HTTPS_PROTO) {
      return true;
    }
  }

  const socket = event.node.req.socket as { encrypted?: boolean } | undefined;
  return Boolean(socket?.encrypted);
}

function buildAuthCookieOptions(
  event: H3Event<EventHandlerRequest>,
  maxAge?: number
) {
  const isHttps = isHttpsRequest(event);
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttps,
    path: COOKIE_PATH,
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

export function setAuthCookiesAndExtractUser(
  event: H3Event<EventHandlerRequest>,
  tokens: AuthTokensPayload
): { user: SessionUser } {
  const payloadBase64: string = tokens.accessToken.split('.')[1];
  const payloadJson: string = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
  const payload = JSON.parse(payloadJson);

  setCookie(
    event,
    'accessToken',
    tokens.accessToken,
    buildAuthCookieOptions(event, ACCESS_TOKEN_MAX_AGE_SECONDS)
  );
  setCookie(
    event,
    'refreshToken',
    tokens.refreshToken,
    buildAuthCookieOptions(event, REFRESH_TOKEN_MAX_AGE_SECONDS)
  );
  setCookie(
    event,
    'refreshTokenId',
    String(tokens.refreshTokenId),
    buildAuthCookieOptions(event, REFRESH_TOKEN_MAX_AGE_SECONDS)
  );

  return {
    user: {
      userId: Number(payload.userId),
      login: String(payload.login),
      role: payload.role as Role,
    },
  };
}

export function clearAuthCookies(event: H3Event<EventHandlerRequest>): void {
  const cookieOptions = buildAuthCookieOptions(event);
  deleteCookie(event, 'accessToken', cookieOptions);
  deleteCookie(event, 'refreshToken', cookieOptions);
  deleteCookie(event, 'refreshTokenId', cookieOptions);
}
