import crypto from 'node:crypto';
import { URL } from 'node:url';
import { AuthError, extractTokenFromRequest, verifyAccessToken } from '../security/jwtVerifier.js';
import { createErrorMessage, parseSignalMessage } from './protocol.js';

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SIGNAL_PATH = '/api/rt/signal';
const MAX_MESSAGE_BYTES = 1024 * 1024; // 1 МБ
const HEARTBEAT_INTERVAL_MS = 25_000;
const CLIENT_TIMEOUT_MS = 60_000;

const OPCODE = Object.freeze({
    CONTINUATION: 0x0,
    TEXT: 0x1,
    BINARY: 0x2,
    CLOSE: 0x8,
    PING: 0x9,
    PONG: 0xa,
});

function writeHttpRejection(socket, statusLine) {
    if (!socket.destroyed && socket.writable) {
        socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    }
    socket.destroy();
}

function isOriginAllowed(originHeader) {
    const configured = process.env.CORS_ORIGIN;
    if (!configured || configured.trim() === '*') {
        return true;
    }

    if (!originHeader || typeof originHeader !== 'string') {
        return false;
    }

    const allowedOrigins = configured
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return allowedOrigins.includes(originHeader.trim());
}

function encodeFrame(opcode, payloadBuffer = Buffer.alloc(0)) {
    const payloadLen = payloadBuffer.length;
    let header;

    if (payloadLen < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x80 | (opcode & 0x0f);
        header[1] = payloadLen;
    } else if (payloadLen <= 0xffff) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | (opcode & 0x0f);
        header[1] = 126;
        header.writeUInt16BE(payloadLen, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | (opcode & 0x0f);
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payloadLen), 2);
    }

    return Buffer.concat([header, payloadBuffer]);
}

function buildClosePayload(code, reason = '') {
    const reasonBuf = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    return payload;
}

export function attachSignalingServer(
    httpServer,
    { onClientConnected, onSignalMessage, onClientDisconnected } = {}
) {
    const clients = new Set();

    const heartbeatTimer = setInterval(() => {
        const now = Date.now();
        for (const client of clients) {
            if (now - client.lastActivity > CLIENT_TIMEOUT_MS) {
                client.close(1001, 'Connection timeout');
                continue;
            }
            client.sendPing();
        }
    }, HEARTBEAT_INTERVAL_MS);

    heartbeatTimer.unref();

    httpServer.on('close', () => {
        clearInterval(heartbeatTimer);
        for (const client of clients) {
            client.close(1001, 'Server shutting down');
        }
        clients.clear();
    });

    httpServer.on('upgrade', (req, socket, head) => {
        let pathname;
        try {
            const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
            pathname = parsedUrl.pathname;
        } catch {
            socket.destroy();
            return;
        }

        if (pathname !== SIGNAL_PATH) {
            writeHttpRejection(socket, '404 Not Found');
            return;
        }

        if (!isOriginAllowed(req.headers.origin)) {
            writeHttpRejection(socket, '403 Forbidden');
            return;
        }

        const upgradeHeader = (req.headers.upgrade || '').toLowerCase();
        const connectionHeader = (req.headers.connection || '').toLowerCase();
        const wsKey = req.headers['sec-websocket-key'];

        if (
            upgradeHeader !== 'websocket' ||
            !connectionHeader.includes('upgrade') ||
            typeof wsKey !== 'string' ||
            wsKey.trim().length === 0
        ) {
            writeHttpRejection(socket, '400 Bad Request');
            return;
        }

        let user;
        try {
            const token = extractTokenFromRequest(req);
            user = verifyAccessToken(token);
        } catch (err) {
            const status =
                err instanceof AuthError && err.statusCode === 500
                    ? '500 Internal Server Error'
                    : '401 Unauthorized';
            writeHttpRejection(socket, status);
            return;
        }

        if (user.role !== 'ADMIN') {
            writeHttpRejection(socket, '403 Forbidden');
            return;
        }

        const acceptKey = crypto
            .createHash('sha1')
            .update(wsKey.trim() + WS_MAGIC_GUID)
            .digest('base64');

        const responseHeaders = [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${acceptKey}`,
            '\r\n',
        ].join('\r\n');

        socket.setNoDelay(true);
        socket.write(responseHeaders);

        let rxBuffer = head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
        let fragmentChunks = [];
        let fragmentTotalBytes = 0;
        let isClosed = false;
        let closeFrameSent = false;

        const client = {
            user: {
                userId: user.userId,
                login: user.login,
                role: user.role,
            },
            lastActivity: Date.now(),

            sendJson(data) {
                if (isClosed || socket.destroyed || !socket.writable) {
                    return;
                }
                const jsonBuf = Buffer.from(JSON.stringify(data), 'utf8');
                socket.write(encodeFrame(OPCODE.TEXT, jsonBuf));
            },

            sendPing() {
                if (isClosed || socket.destroyed || !socket.writable) {
                    return;
                }
                socket.write(encodeFrame(OPCODE.PING, Buffer.alloc(0)));
            },

            close(code = 1000, reason = '') {
                if (isClosed) {
                    return;
                }
                if (!closeFrameSent && !socket.destroyed && socket.writable) {
                    closeFrameSent = true;
                    socket.end(encodeFrame(OPCODE.CLOSE, buildClosePayload(code, reason)));
                } else {
                    socket.destroy();
                }
                cleanup();
            },
        };

        function cleanup() {
            if (isClosed) {
                return;
            }
            isClosed = true;
            rxBuffer = Buffer.alloc(0);
            fragmentChunks = [];
            fragmentTotalBytes = 0;
            clients.delete(client);
            onClientDisconnected?.(client);
        }

        function processFrames() {
            while (!isClosed && rxBuffer.length >= 2) {
                const firstByte = rxBuffer[0];
                const secondByte = rxBuffer[1];

                const fin = (firstByte & 0x80) !== 0;
                const rsv = firstByte & 0x70;
                const opcode = firstByte & 0x0f;
                const masked = (secondByte & 0x80) !== 0;

                if (rsv !== 0 || !masked) {
                    client.close(1002, 'Protocol error');
                    return;
                }

                const isControlFrame = (opcode & 0x08) !== 0;
                let payloadLen = secondByte & 0x7f;
                let offset = 2;

                if (isControlFrame && (!fin || payloadLen > 125)) {
                    client.close(1002, 'Invalid control frame');
                    return;
                }

                if (payloadLen === 126) {
                    if (rxBuffer.length < 4) {
                        return;
                    }
                    payloadLen = rxBuffer.readUInt16BE(2);
                    offset = 4;
                } else if (payloadLen === 127) {
                    if (rxBuffer.length < 10) {
                        return;
                    }
                    const len64 = rxBuffer.readBigUInt64BE(2);
                    if (len64 > BigInt(MAX_MESSAGE_BYTES)) {
                        client.close(1009, 'Message too big');
                        return;
                    }
                    payloadLen = Number(len64);
                    offset = 10;
                }

                if (payloadLen > MAX_MESSAGE_BYTES) {
                    client.close(1009, 'Message too big');
                    return;
                }

                const frameSize = offset + 4 + payloadLen;
                if (rxBuffer.length < frameSize) {
                    return;
                }

                const maskKey = rxBuffer.subarray(offset, offset + 4);
                const maskedPayload = rxBuffer.subarray(offset + 4, frameSize);
                const unmaskedPayload = Buffer.allocUnsafe(payloadLen);

                for (let i = 0; i < payloadLen; i++) {
                    unmaskedPayload[i] = maskedPayload[i] ^ maskKey[i & 3];
                }

                rxBuffer = rxBuffer.length === frameSize ? Buffer.alloc(0) : rxBuffer.subarray(frameSize);
                client.lastActivity = Date.now();

                switch (opcode) {
                    case OPCODE.CLOSE: {
                        const replyCode = unmaskedPayload.length >= 2 ? unmaskedPayload.readUInt16BE(0) : 1000;
                        client.close(replyCode);
                        return;
                    }

                    case OPCODE.PING: {
                        if (!socket.destroyed && socket.writable) {
                            socket.write(encodeFrame(OPCODE.PONG, unmaskedPayload));
                        }
                        break;
                    }

                    case OPCODE.PONG: {
                        break;
                    }

                    case OPCODE.TEXT: {
                        if (fragmentChunks.length > 0) {
                            client.close(1002, 'Unexpected new frame during fragmented message');
                            return;
                        }
                        if (fin) {
                            handleCompleteTextPayload(unmaskedPayload);
                        } else {
                            fragmentChunks.push(unmaskedPayload);
                            fragmentTotalBytes = unmaskedPayload.length;
                        }
                        break;
                    }

                    case OPCODE.CONTINUATION: {
                        if (fragmentChunks.length === 0) {
                            client.close(1002, 'Unexpected continuation frame');
                            return;
                        }
                        fragmentTotalBytes += unmaskedPayload.length;
                        if (fragmentTotalBytes > MAX_MESSAGE_BYTES) {
                            client.close(1009, 'Fragmented message too big');
                            return;
                        }
                        fragmentChunks.push(unmaskedPayload);
                        if (fin) {
                            const completeBuffer = Buffer.concat(fragmentChunks, fragmentTotalBytes);
                            fragmentChunks = [];
                            fragmentTotalBytes = 0;
                            handleCompleteTextPayload(completeBuffer);
                        }
                        break;
                    }

                    default: {
                        client.close(1003, 'Unsupported frame opcode');
                        return;
                    }
                }
            }
        }

        function handleCompleteTextPayload(buffer) {
            const rawText = buffer.toString('utf8');
            try {
                const parsedSignal = parseSignalMessage(rawText);
                onSignalMessage?.(client, parsedSignal);
            } catch (err) {
                client.sendJson(createErrorMessage(err.message || 'Ошибка обработки сигнального сообщения'));
            }
        }

        socket.on('data', (chunk) => {
            rxBuffer = rxBuffer.length === 0 ? chunk : Buffer.concat([rxBuffer, chunk]);
            if (rxBuffer.length > MAX_MESSAGE_BYTES + 14) {
                client.close(1009, 'Buffer limit exceeded');
                return;
            }
            processFrames();
        });

        socket.on('error', () => {
            cleanup();
        });

        socket.on('close', () => {
            cleanup();
        });

        clients.add(client);
        onClientConnected?.(client);

        if (rxBuffer.length > 0) {
            processFrames();
        }
    });
}
