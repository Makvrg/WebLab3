import http from 'node:http';
import { config } from './config.js';
import { readJsonBody, sendJson } from './http/httpUtils.js';
import { authenticateRequest } from './security/jwtVerifier.js';
import { appEvents } from './events.js';
import { handleCsvExport } from './csv/csvExportStream.js';
import { handleCsvImport } from './csv/csvImportHandler.js';
import { PeerManager } from './webrtc/peerManager.js';

const LISTEN_HOST = '0.0.0.0';
const MAX_RECENT_EVENT_IDS = 1000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const ADMIN_ROLE = 'ADMIN';

const HTTP_STATUS = Object.freeze({
   OK: 200,
   BAD_REQUEST: 400,
   UNAUTHORIZED: 401,
   FORBIDDEN: 403,
   NOT_FOUND: 404,
   PAYLOAD_TOO_LARGE: 413,
   INTERNAL_SERVER_ERROR: 500,
});

const peerManager = new PeerManager();
peerManager.bindAppEvents(appEvents);

const recentEventIds = new Set();

function rememberEventId(eventId) {
   if (recentEventIds.has(eventId)) {
      return false;
   }
   recentEventIds.add(eventId);
   if (recentEventIds.size > MAX_RECENT_EVENT_IDS) {
      const oldestEventId = recentEventIds.values().next().value;
      if (oldestEventId !== undefined) {
         recentEventIds.delete(oldestEventId);
      }
   }
   return true;
}

const server = http.createServer(async (req, res) => {
   const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
   const { pathname, searchParams } = url;

   try {
      if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/rt/health')) {
         return sendJson(res, HTTP_STATUS.OK, {
            status: 'ok',
            service: 'node-backend',
            activePeers: peerManager.size,
         });
      }

      if (req.method === 'POST' && pathname === '/internal/events') {
         const secret = req.headers['x-internal-secret'];
         if (secret !== config.internalApiSecret) {
            return sendJson(res, HTTP_STATUS.FORBIDDEN, { error: 'Forbidden: invalid internal secret' });
         }

         const event = await readJsonBody(req);
         if (!event || typeof event !== 'object' || Array.isArray(event) || !event.eventId) {
            throw new Error('INVALID_EVENT');
         }

         const eventId = String(event.eventId);
         if (!rememberEventId(eventId)) {
            return sendJson(res, HTTP_STATUS.OK, { status: 'accepted', duplicate: true });
         }

         console.log(
             `[Audit] Новое событие: ${event.action} | Студент: ${event.isuId} | Автор: ${event.actor?.login}`
         );
         appEvents.emit('student:changed', event);
         return sendJson(res, HTTP_STATUS.OK, { status: 'accepted', duplicate: false });
      }

      if (req.method === 'POST' && pathname === '/api/rtc/session') {
         const user = authenticateRequest(req);
         if (!user) {
            return sendJson(res, HTTP_STATUS.UNAUTHORIZED, { error: 'Unauthorized' });
         }
         if (user.role !== ADMIN_ROLE) {
            return sendJson(res, HTTP_STATUS.FORBIDDEN, { error: 'Forbidden: ADMIN role required' });
         }

         const body = await readJsonBody(req);
         if (
             !body ||
             typeof body !== 'object' ||
             Array.isArray(body) ||
             typeof body.sdp !== 'string' ||
             body.sdp.trim().length === 0
         ) {
            return sendJson(res, HTTP_STATUS.BAD_REQUEST, {
               error: 'Поле sdp обязательно и должно быть непустой строкой',
            });
         }

         const answer = await peerManager.createSession(user, body.sdp);
         return sendJson(res, HTTP_STATUS.OK, answer);
      }

      if (req.method === 'GET' && pathname === '/api/rt/csv/export') {
         return await handleCsvExport(req, res, searchParams);
      }

      if (req.method === 'POST' && pathname === '/api/rt/csv/import') {
         return await handleCsvImport(req, res, searchParams);
      }

      return sendJson(res, HTTP_STATUS.NOT_FOUND, { error: 'Not Found', path: pathname });
   } catch (err) {
      if (err.message === 'PAYLOAD_TOO_LARGE') {
         return sendJson(res, HTTP_STATUS.PAYLOAD_TOO_LARGE, { error: 'Payload too large' });
      }
      if (err.message === 'INVALID_JSON' || err.message === 'INVALID_EVENT' || err.message === 'INVALID_SDP') {
         return sendJson(res, HTTP_STATUS.BAD_REQUEST, { error: err.message });
      }
      console.error('[HTTP Error]', err);
      if (!res.headersSent) {
         return sendJson(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: 'Internal Server Error' });
      }
      res.end();
   }
});

let isShuttingDown = false;

function shutdown(signal) {
   if (isShuttingDown) {
      return;
   }
   isShuttingDown = true;
   console.log(`[System] Получен сигнал ${signal}, завершение работы...`);

   peerManager.closeAll();

   const forceExitTimer = setTimeout(() => {
      console.error('[System] Принудительное завершение по таймауту');
      process.exit(1);
   }, SHUTDOWN_TIMEOUT_MS);
   forceExitTimer.unref();

   server.close(() => {
      clearTimeout(forceExitTimer);
      console.log('[System] Сервер остановлен');
      process.exit(0);
   });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function bootstrap() {
   server.listen(config.port, LISTEN_HOST, () => {
      console.log(`node-backend listening on ${LISTEN_HOST}:${config.port}`);
   });
}

bootstrap().catch((err) => {
   console.error('[System] Критическая ошибка при запуске node-backend:', err);
   process.exit(1);
});
