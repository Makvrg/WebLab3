import {
  defineEventHandler,
  getCookie,
  createError,
  H3Event,
  EventHandlerRequest,
} from 'h3';
import {
  AuthTokensPayload,
  SessionUser,
  clearAuthCookies,
  setAuthCookiesAndExtractUser,
} from '../../../utils/auth-cookies';
import { getBackendUrl } from '../../../utils/backend-url';

export default defineEventHandler(
  async (event: H3Event<EventHandlerRequest>): Promise<{ user: SessionUser }> => {
    const refreshToken: string | undefined = getCookie(event, 'refreshToken');
    const refreshTokenId: string | undefined = getCookie(event, 'refreshTokenId');
    const backendUrl: string = getBackendUrl();

    if (!refreshToken || !refreshTokenId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Refresh token отсутствует в куках',
      });
    }

    const response: Response = await fetch(`${backendUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshTokenId: Number(refreshTokenId),
        refreshToken,
      }),
    });

    if (!response.ok) {
      clearAuthCookies(event);
      throw createError({
        statusCode: 401,
        statusMessage: 'Срок действия сессии истек',
      });
    }

    const tokens = (await response.json()) as AuthTokensPayload;
    return setAuthCookiesAndExtractUser(event, tokens);
  }
);
