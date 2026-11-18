import http from 'node:http';
import { appEvents } from './events.js';
import { attachSignalingServer } from './webrtc/wsServer.js';
import { PeerManager } from './webrtc/peerManager.js';

const PORT = Number(process.env.PORT) || 4000;

const peerManager = new PeerManager();
peerManager.bindAppEvents(appEvents);

function sendJson(res, statusCode, body) {
   const payload = JSON.stringify(body);
   res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
   });
   res.end(payload);
}

/**
 * Точка расширения для HTTP-роутера (журнал аудита и импорт/экспорт CSV).
 */
async function handleHttpRequest(req, res) {
   const pathname = (req.url || '/').split('?')[0];

   if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/rt/health')) {
      sendJson(res, 200, {
         status: 'ok',
         activePeers: peerManager.size,
      });
      return;
   }

   sendJson(res, 404, {
      error: {
         code: 'NOT_FOUND',
         message: `Маршрут ${req.method} ${pathname} не найден`,
      },
   });
}

const server = http.createServer((req, res) => {
   handleHttpRequest(req, res).catch((err) => {
      console.error('[HTTP] Необработанная ошибка запроса:', err);
      if (!res.headersSent) {
         sendJson(res, 500, {
            error: {
               code: 'INTERNAL_SERVER_ERROR',
               message: 'Внутренняя ошибка сервера',
            },
         });
      } else {
         res.end();
      }
   });
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

server.listen(PORT, () => {
   console.log(`node-backend listening on port ${PORT}`);
});
