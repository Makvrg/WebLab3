import { createError } from 'h3';

const HTTP_INTERNAL_SERVER_ERROR = 500;

export function getBackendUrl(): string {
  const rawUrl: string | undefined = process.env['BACKEND_URL'];
  if (!rawUrl || rawUrl.trim().length === 0) {
    throw createError({
      statusCode: HTTP_INTERNAL_SERVER_ERROR,
      statusMessage: 'BACKEND_URL не задан в переменных окружения',
    });
  }
  return rawUrl.trim().replace(/\/+$/, '');
}
