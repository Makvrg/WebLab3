import { defineEventHandler, getCookie, proxyRequest, getRequestURL } from 'h3';

export default defineEventHandler(async (event) => {
  const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8080';
  const token = getCookie(event, 'accessToken');

  const url = getRequestURL(event);
  const targetPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = `${backendUrl}${targetPath}${url.search}`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return proxyRequest(event, targetUrl, {
    headers,
  });
});
