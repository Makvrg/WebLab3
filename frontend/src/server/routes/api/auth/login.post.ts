import {
  defineEventHandler,
  readBody,
  createError,
  H3Event,
  EventHandlerRequest,
} from 'h3';
import {
  AuthTokensPayload,
  SessionUser,
  setAuthCookiesAndExtractUser,
} from '../../../utils/auth-cookies';

export default defineEventHandler(
  async (event: H3Event<EventHandlerRequest>): Promise<{ user: SessionUser }> => {
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

    const tokens = (await response.json()) as AuthTokensPayload;
    return setAuthCookiesAndExtractUser(event, tokens);
  }
);
