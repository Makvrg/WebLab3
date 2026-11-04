import { defineEventHandler, getCookie, getRequestURL, proxyRequest } from 'h3';
import { Buffer } from 'node:buffer';

async function readNodeStream(req: any): Promise<string> {
  if (req.body) {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

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

  if (event.node.req.method?.toUpperCase() === 'QUERY') {
    const rawBody = await readNodeStream(event.node.req);

    const queryHeaders: Record<string, string> = {
      ...headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const backendRes = await fetch(targetUrl, {
      method: 'QUERY',
      headers: queryHeaders,
      body: rawBody && rawBody.trim().length > 0 ? rawBody : '{}',
    });

    event.node.res.statusCode = backendRes.status;

    backendRes.headers.forEach((val, key) => {
      if (!['content-encoding', 'content-length'].includes(key.toLowerCase())) {
        event.node.res.setHeader(key, val);
      }
    });

    const text = await backendRes.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return proxyRequest(event, targetUrl, {
    headers,
  });
});
