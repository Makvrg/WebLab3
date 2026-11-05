import {defineEventHandler, readBody, createError,
  H3Event, EventHandlerRequest} from 'h3';

export default defineEventHandler(
  async (event: H3Event<EventHandlerRequest>): Promise<{ success: true }> => {
    const body = await readBody(event);
    const backendUrl: string = process.env['BACKEND_URL'] || 'http://localhost:8080';

    const response: Response = await fetch(`${backendUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch((): {} => ({}));
      throw createError({
        statusCode: response.status,
        statusMessage: err.error?.message || err.message || 'Ошибка регистрации',
      });
    }

    return { success: true };
  });
