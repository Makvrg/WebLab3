import http from 'node:http';
import { config } from './config.js';
import { readJsonBody, sendJson } from './http/httpUtils.js';
import { authenticateRequest } from './security/jwtVerifier.js';
import { initAuditStore, appendAuditEvent, getAuditEvents } from './audit/auditStore.js';
import { appEvents } from './events.js';
import { handleCsvExport } from './csv/csvExportStream.js';
import { handleCsvImport } from './csv/csvImportHandler.js';
import { attachSignalingServer } from './webrtc/wsServer.js';
import { PeerManager } from './webrtc/peerManager.js';

const peerManager = new PeerManager();
peerManager.bindAppEvents(appEvents);

appEvents.on('audit:created', (event) => {
   console.log(
       `[Audit] Новое событие: ${event.action} | Студент: ${event.isuId} | Автор: ${event.actor?.login}`
   );
   appEvents.emit('student:changed', event);
});

const server = http.createServer(async (req, res) => {
   const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
   const { pathname, searchParams } = url;

   try {
      if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/rt/health')) {
         return sendJson(res, 200, {
            status: 'ok',
            service: 'node-backend',
            activePeers: peerManager.size,
         });
      }

      if (req.method === 'POST' && pathname === '/internal/events') {
         const secret = req.headers['x-internal-secret'];
         if (secret !== config.internalApiSecret) {
            return sendJson(res, 403, { error: 'Forbidden: invalid internal secret' });
         }

         const event = await readJsonBody(req);
         const result = await appendAuditEvent(event);
         return sendJson(res, 200, { status: 'accepted', ...result });
      }

      if (req.method === 'GET' && pathname === '/api/rt/audit') {
         const user = authenticateRequest(req);
         if (!user) {
            return sendJson(res, 401, { error: 'Unauthorized' });
         }
         if (user.role !== 'ADMIN') {
            return sendJson(res, 403, { error: 'Forbidden: ADMIN role required' });
         }

         const page = Math.max(0, Number(searchParams.get('page') || 0));
         const rawSize = searchParams.get('size') ?? searchParams.get('pageSize') ?? 20;
         const size = Math.min(100, Math.max(1, Number(rawSize)));

         const result = getAuditEvents({
            page,
            size,
            action: searchParams.get('action') || undefined,
            source: searchParams.get('source') || undefined,
            isuId: searchParams.get('isuId') || undefined,
            actorLogin: searchParams.get('actorLogin') || undefined,
         });

         return sendJson(res, 200, result);
      }

      if (req.method === 'GET' && pathname === '/api/rt/csv/export') {
         return await handleCsvExport(req, res, searchParams);
      }

      if (req.method === 'POST' && pathname === '/api/rt/csv/import') {
         return await handleCsvImport(req, res, searchParams);
      }

      return sendJson(res, 404, { error: 'Not Found', path: pathname });
   } catch (err) {
      if (err.message === 'PAYLOAD_TOO_LARGE') {
         return sendJson(res, 413, { error: 'Payload too large' });
      }
      if (err.message === 'INVALID_JSON' || err.message === 'INVALID_EVENT') {
         return sendJson(res, 400, { error: err.message });
      }
      console.error('[HTTP Error]', err);
      if (!res.headersSent) {
         return sendJson(res, 500, { error: 'Internal Server Error' });
      }
      res.end();
   }
});

attachSignalingServer(server, {
   onClientConnected(wsClient) {
      const peerId = peerManager.registerClient(wsClient);
      console.log(
          `[Signaling] Подключен клиент: peerId=${peerId}, user=${wsClient.user.login}, role=${wsClient.user.role}`
      );
   },

   onSignalMessage(wsClient, message) {
      const peerId = peerManager.getPeerIdByClient(wsClient);
      if (!peerId) {
         return;
      }
      peerManager.handleSignalMessage(peerId, message).catch((err) => {
         console.error(`[Signaling] Ошибка обработки сообщения от peerId=${peerId}:`, err);
      });
   },

   onClientDisconnected(wsClient) {
      const peerId = peerManager.getPeerIdByClient(wsClient);
      if (!peerId) {
         return;
      }
      peerManager.removePeer(peerId);
      console.log(`[Signaling] Клиент отключен: peerId=${peerId}`);
   },
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
   }, 5000);
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
   await initAuditStore();
   server.listen(config.port, '0.0.0.0', () => {
      console.log(`node-backend listening on 0.0.0.0:${config.port}`);
   });
}

bootstrap().catch((err) => {
   console.error('[System] Критическая ошибка при запуске node-backend:', err);
   process.exit(1);
});
