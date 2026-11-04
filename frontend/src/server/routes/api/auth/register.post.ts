import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';

  const response = await fetch(`${backendUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw createError({
      statusCode: response.status,
      statusMessage: err.error?.message || err.message || 'Ошибка регистрации',
    });
  }

  return { success: true };
});
