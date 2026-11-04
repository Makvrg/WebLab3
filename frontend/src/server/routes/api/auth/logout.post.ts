import { defineEventHandler, getCookie, deleteCookie } from 'h3';

export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, 'refreshToken');
  const refreshTokenId = getCookie(event, 'refreshTokenId');
  const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';

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
