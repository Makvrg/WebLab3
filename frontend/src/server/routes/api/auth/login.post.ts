import {defineEventHandler, readBody, setCookie, createError,
  H3Event, EventHandlerRequest} from 'h3';

export default defineEventHandler(
  async (event: H3Event<EventHandlerRequest>): Promise<{
    user: { userId: number; login: string; role: any }
  }> => {
    const body = await readBody(event);
    const backendUrl: string = process.env['BACKEND_URL'] || 'http://localhost:8080';

    const response: Response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch((): {} => ({}));
      throw createError({
        statusCode: response.status,
        statusMessage: errorData.error?.message || errorData.message || 'Неверный логин или пароль',
      });
    }

    const tokens = await response.json();

    const payloadBase64 = tokens.accessToken.split('.')[1];
    const payloadJson: string = Buffer.from(payloadBase64, 'base64').toString('utf-8');
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
        role: payload.role,
      },
    };
  });
