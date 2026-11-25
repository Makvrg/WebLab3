import {
  defineEventHandler,
  getCookie,
  H3Event,
  EventHandlerRequest,
} from 'h3';
import { clearAuthCookies } from '../../../utils/auth-cookies';
import { getBackendUrl } from '../../../utils/backend-url';

export default defineEventHandler(
  async (event: H3Event<EventHandlerRequest>): Promise<{ success: true }> => {
    const refreshToken: string | undefined = getCookie(event, 'refreshToken');
    const refreshTokenId: string | undefined = getCookie(event, 'refreshTokenId');
    const backendUrl: string = getBackendUrl();

    if (refreshToken && refreshTokenId) {
      try {
        await fetch(`${backendUrl}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refreshTokenId: Number(refreshTokenId),
            refreshToken,
          }),
        });
      } catch {
      }
    }

    clearAuthCookies(event);

    return { success: true };
  }
);
