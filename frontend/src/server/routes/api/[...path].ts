import { defineEventHandler, getCookie, getRequestURL, proxyRequest, readRawBody } from 'h3';

export default defineEventHandler(async (event) => {
  const rawBackendUrl = process.env['BACKEND_URL'] || 'http://backend:8080';
  const backendUrl = rawBackendUrl.replace(/\/+$/, '');
  const token = getCookie(event, 'accessToken');

  const url = getRequestURL(event);
  const targetPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = `${backendUrl}${targetPath}${url.search}`;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const incomingContentType = event.node.req.headers['content-type'];
  if (incomingContentType) {
    headers['content-type'] = incomingContentType;
  }

  if ((event.method as string) === 'QUERY') {
    const rawBody = await readRawBody(event);

    const backendRes = await fetch(targetUrl, {
      method: 'QUERY',
      headers: {
        ...headers,
        'Content-Type': incomingContentType || 'application/json',
      },
      body: rawBody || '{}',
    });

    event.node.res.statusCode = backendRes.status;
    backendRes.headers.forEach((val, key) => {
      if (!['content-encoding', 'content-length'].includes(key.toLowerCase())) {
        event.node.res.setHeader(key, val);
      }
    });

    return await backendRes.text();
  }

  return proxyRequest(event, targetUrl, {
    headers,
  });
});
