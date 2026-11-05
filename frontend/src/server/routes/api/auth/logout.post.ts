import {defineEventHandler, getCookie, deleteCookie,
  H3Event, EventHandlerRequest} from 'h3';

export default defineEventHandler(
  async (event: H3Event<EventHandlerRequest>): Promise<{ success: true }> => {
    const refreshToken: string | undefined = getCookie(event, 'refreshToken');
    const refreshTokenId: string | undefined = getCookie(event, 'refreshTokenId');
    const backendUrl: string = process.env['BACKEND_URL'] || 'http://localhost:8080';

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

    deleteCookie(event, 'accessToken', { path: '/' });
    deleteCookie(event, 'refreshToken', { path: '/' });
    deleteCookie(event, 'refreshTokenId', { path: '/' });

    return { success: true };
  });
