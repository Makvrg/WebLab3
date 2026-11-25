import crypto from 'node:crypto';
import { RTCPeerConnection } from 'werift';
import { config } from '../config.js';
import {
    CHANNEL_TYPES,
    createCsvProgressPayload,
    createPongPayload,
    createStudentEventPayload,
} from './protocol.js';

const ICE_GATHERING_TIMEOUT_MS = 2_500;
const SESSION_CLEANUP_INTERVAL_MS = 15_000;
const HANDSHAKE_TIMEOUT_MS = 30_000;
const INACTIVITY_TIMEOUT_MS = 60_000;
const ADMIN_ROLE = 'ADMIN';
const TERMINAL_STATES = new Set(['failed', 'closed']);

function waitForIceGatheringComplete(pc, timeoutMs = ICE_GATHERING_TIMEOUT_MS) {
    if (pc.iceGatheringState === 'complete') {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let settled = false;

        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            pc.onicegatheringstatechange = null;
            pc.onicecandidate = null;
            resolve();
        };

        const timer = setTimeout(finish, timeoutMs);

        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
                finish();
            }
        };

        pc.onicecandidate = (event) => {
            const candidate = event?.candidate !== undefined ? event.candidate : event;
            if (!candidate || !candidate.candidate) {
                finish();
            }
        };
    });
}

export class PeerManager {
    constructor() {
        this.sessions = new Map();
        this.boundEmitters = new WeakSet();

        this.cleanupTimer = setInterval(() => {
            this.#cleanupStaleSessions();
        }, SESSION_CLEANUP_INTERVAL_MS);
        this.cleanupTimer.unref();
    }

    get size() {
        return this.sessions.size;
    }

    async createSession(user, offerSdp) {
        const peerId = crypto.randomUUID();
        const now = Date.now();

        const rtcConfig = {
            iceServers: config.webrtcIceServers,
            icePortRange: [config.webrtcPortMin, config.webrtcPortMax],
            iceAdditionalHostAddresses: config.webrtcPublicIp ? [config.webrtcPublicIp] : [],
            iceUseIpv6: false,
        };

        const pc = new RTCPeerConnection(rtcConfig);
        const session = {
            peerId,
            userId: user.userId,
            login: user.login,
            role: user.role,
            pc,
            dataChannel: null,
            connected: false,
            createdAt: now,
            lastActivity: now,
        };

        pc.ondatachannel = (event) => {
            if (session.pc !== pc) {
                return;
            }
            const channel = event?.channel ?? event;
            if (!channel) {
                return;
            }
            this.#attachDataChannel(session, pc, channel);
        };

        const checkTerminalState = () => {
            if (session.pc !== pc) {
                return;
            }
            if (TERMINAL_STATES.has(pc.connectionState) || TERMINAL_STATES.has(pc.iceConnectionState)) {
                this.removePeer(peerId);
            }
        };

        pc.onconnectionstatechange = checkTerminalState;
        pc.oniceconnectionstatechange = checkTerminalState;

        try {
            try {
                await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
            } catch (err) {
                const sdpErr = new Error('INVALID_SDP');
                sdpErr.cause = err;
                throw sdpErr;
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await waitForIceGatheringComplete(pc, ICE_GATHERING_TIMEOUT_MS);

            const answerSdp = pc.localDescription?.sdp;
            if (!answerSdp) {
                throw new Error('Не удалось получить локальный SDP answer');
            }

            session.lastActivity = Date.now();
            this.sessions.set(peerId, session);

            console.log(
                `[WebRTC] Сессия создана: peerId=${peerId}, user=${session.login} (${session.role})`
            );

            return {
                peerId,
                type: 'answer',
                sdp: answerSdp,
            };
        } catch (err) {
            this.sessions.delete(peerId);
            this.#cleanupPeerConnection(session);
            throw err;
        }
    }

    #attachDataChannel(session, pc, channel) {
        if (session.dataChannel && session.dataChannel !== channel) {
            this.#detachAndCloseChannel(session.dataChannel);
        }
        session.dataChannel = channel;

        channel.onopen = () => {
            if (session.pc !== pc || session.dataChannel !== channel) {
                return;
            }
            session.connected = true;
            session.lastActivity = Date.now();
            console.log(
                `[WebRTC] DataChannel открыт: peerId=${session.peerId}, user=${session.login} (${session.role})`
            );
        };

        channel.onclose = () => {
            if (session.dataChannel === channel) {
                this.removePeer(session.peerId);
            }
        };

        channel.onerror = (err) => {
            console.warn(
                `[WebRTC] Ошибка DataChannel (peerId=${session.peerId}):`,
                err?.message || err
            );
        };

        channel.onmessage = (event) => {
            if (session.dataChannel !== channel) {
                return;
            }
            const raw = event?.data !== undefined ? event.data : event;

            let text;
            if (Buffer.isBuffer(raw)) {
                text = raw.toString('utf8');
            } else if (raw instanceof ArrayBuffer) {
                text = Buffer.from(raw).toString('utf8');
            } else if (ArrayBuffer.isView(raw)) {
                text = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8');
            } else {
                text = String(raw);
            }

            try {
                const parsed = JSON.parse(text);
                if (parsed && parsed.type === CHANNEL_TYPES.PING) {
                    session.lastActivity = Date.now();
                    if (channel.readyState === 'open') {
                        channel.send(JSON.stringify(createPongPayload(parsed.ts)));
                    }
                }
            } catch {
            }
        };
    }

    #detachAndCloseChannel(channel) {
        if (!channel) {
            return;
        }
        try {
            channel.onopen = null;
            channel.onclose = null;
            channel.onerror = null;
            channel.onmessage = null;
            if (channel.readyState !== 'closed') {
                channel.close();
            }
        } catch {
        }
    }

    #cleanupPeerConnection(session) {
        if (session.dataChannel) {
            this.#detachAndCloseChannel(session.dataChannel);
            session.dataChannel = null;
        }

        if (session.pc) {
            const pc = session.pc;
            session.pc = null;
            try {
                pc.ondatachannel = null;
                pc.onicecandidate = null;
                pc.onicegatheringstatechange = null;
                pc.onconnectionstatechange = null;
                pc.oniceconnectionstatechange = null;
                pc.close();
            } catch {
            }
        }

        session.connected = false;
    }

    #cleanupStaleSessions() {
        const now = Date.now();
        for (const [peerId, session] of this.sessions.entries()) {
            if (!session.connected && now - session.createdAt > HANDSHAKE_TIMEOUT_MS) {
                console.log(`[WebRTC] Таймаут открытия DataChannel, закрытие сессии: peerId=${peerId}`);
                this.removePeer(peerId);
                continue;
            }
            if (now - session.lastActivity > INACTIVITY_TIMEOUT_MS) {
                console.log(`[WebRTC] Таймаут неактивности, закрытие сессии: peerId=${peerId}`);
                this.removePeer(peerId);
            }
        }
    }

    removePeer(peerId) {
        const session = this.sessions.get(peerId);
        if (!session) {
            return;
        }

        this.sessions.delete(peerId);
        this.#cleanupPeerConnection(session);
    }

    closeAll() {
        clearInterval(this.cleanupTimer);
        for (const peerId of Array.from(this.sessions.keys())) {
            this.removePeer(peerId);
        }
    }

    bindAppEvents(appEvents) {
        if (!appEvents || this.boundEmitters.has(appEvents)) {
            return;
        }
        this.boundEmitters.add(appEvents);

        appEvents.on('student:changed', (auditEvent) => {
            if (!auditEvent) {
                return;
            }
            const payload = createStudentEventPayload(auditEvent);
            const serialized = JSON.stringify(payload);

            for (const session of this.sessions.values()) {
                if (session.role !== ADMIN_ROLE) {
                    continue;
                }
                if (session.dataChannel && session.dataChannel.readyState === 'open') {
                    try {
                        session.dataChannel.send(serialized);
                    } catch (err) {
                        console.warn(
                            `[WebRTC] Не удалось отправить STUDENT_EVENT пиру ${session.peerId}:`,
                            err?.message || err
                        );
                    }
                }
            }
        });

        appEvents.on('csv:progress', (progressEvent) => {
            if (!progressEvent || progressEvent.userId === undefined || progressEvent.userId === null) {
                return;
            }
            const payload = createCsvProgressPayload(progressEvent);
            const serialized = JSON.stringify(payload);

            for (const session of this.sessions.values()) {
                if (session.userId !== progressEvent.userId) {
                    continue;
                }
                if (session.dataChannel && session.dataChannel.readyState === 'open') {
                    try {
                        session.dataChannel.send(serialized);
                    } catch (err) {
                        console.warn(
                            `[WebRTC] Не удалось отправить CSV_PROGRESS пиру ${session.peerId}:`,
                            err?.message || err
                        );
                    }
                }
            }
        });
    }
}
