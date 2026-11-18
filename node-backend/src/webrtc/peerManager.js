import crypto from 'node:crypto';
import { RTCPeerConnection } from 'werift';
import {
    CHANNEL_TYPES,
    SIGNAL_TYPES,
    createAnswerMessage,
    createCandidateMessage,
    createCsvProgressPayload,
    createErrorMessage,
    createPongPayload,
    createStudentEventPayload,
    createWelcomeMessage,
} from './protocol.js';

const DEFAULT_ICE_SERVERS = [
    { urls: process.env.STUN_URL || 'stun:stun.l.google.com:19302' },
];

export class PeerManager {
    constructor() {
        /** @type {Map<string, object>} */
        this.sessions = new Map();
        /** @type {WeakMap<object, string>} */
        this.clientToPeerId = new WeakMap();
        this.boundEmitters = new WeakSet();
    }

    get size() {
        return this.sessions.size;
    }

    getPeerIdByClient(wsClient) {
        return this.clientToPeerId.get(wsClient) ?? null;
    }

    registerClient(wsClient) {
        const peerId = crypto.randomUUID();
        const { userId, login, role } = wsClient.user;

        const session = {
            peerId,
            userId,
            login,
            role,
            wsClient,
            pc: null,
            dataChannel: null,
            pendingCandidates: [],
            remoteDescriptionSet: false,
            createdAt: Date.now(),
        };

        this.sessions.set(peerId, session);
        this.clientToPeerId.set(wsClient, peerId);

        wsClient.sendJson(createWelcomeMessage(peerId, role));
        return peerId;
    }

    async handleSignalMessage(peerId, message) {
        const session = this.sessions.get(peerId);
        if (!session) {
            return;
        }

        if (message.type === SIGNAL_TYPES.OFFER) {
            await this.#handleOffer(session, message.sdp);
            return;
        }

        if (message.type === SIGNAL_TYPES.CANDIDATE) {
            await this.#handleCandidate(session, message.candidate);
        }
    }

    async #handleOffer(session, sdp) {
        // При повторном offer корректно закрываем предыдущее WebRTC-соединение пира
        this.#cleanupPeerConnection(session);
        session.pendingCandidates = [];
        session.remoteDescriptionSet = false;

        const pc = new RTCPeerConnection({
            iceServers: DEFAULT_ICE_SERVERS,
        });
        session.pc = pc;

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

        pc.onicecandidate = (event) => {
            if (session.pc !== pc) {
                return;
            }
            const candidate = event?.candidate !== undefined ? event.candidate : event;
            if (!candidate || !candidate.candidate) {
                return;
            }

            const serializedCandidate =
                typeof candidate.toJSON === 'function'
                    ? candidate.toJSON()
                    : {
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid ?? null,
                        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
                    };

            session.wsClient.sendJson(createCandidateMessage(serializedCandidate));
        };

        const checkTerminalState = () => {
            if (session.pc !== pc) {
                return;
            }
            const connState = pc.connectionState;
            const iceState = pc.iceConnectionState;
            if (connState === 'failed' || connState === 'closed' || iceState === 'failed' || iceState === 'closed') {
                this.removePeer(session.peerId);
            }
        };

        pc.onconnectionstatechange = checkTerminalState;
        pc.oniceconnectionstatechange = checkTerminalState;

        try {
            await pc.setRemoteDescription({ type: 'offer', sdp });
            if (session.pc !== pc) {
                return;
            }
            session.remoteDescriptionSet = true;

            if (session.pendingCandidates.length > 0) {
                const queued = session.pendingCandidates.splice(0, session.pendingCandidates.length);
                for (const candidate of queued) {
                    if (session.pc !== pc) {
                        return;
                    }
                    await this.#safeAddIceCandidate(pc, candidate);
                }
            }

            const answer = await pc.createAnswer();
            if (session.pc !== pc) {
                return;
            }
            await pc.setLocalDescription(answer);
            if (session.pc !== pc) {
                return;
            }

            const answerSdp = pc.localDescription?.sdp || answer.sdp;
            session.wsClient.sendJson(createAnswerMessage(answerSdp));
        } catch (err) {
            if (session.pc === pc) {
                this.#cleanupPeerConnection(session);
                session.wsClient.sendJson(
                    createErrorMessage(err?.message || 'Ошибка установки WebRTC-соединения', 'WEBRTC_NEGOTIATION_ERROR')
                );
            }
        }
    }

    async #handleCandidate(session, candidate) {
        if (!candidate || !candidate.candidate) {
            return;
        }

        if (!session.pc || !session.remoteDescriptionSet) {
            session.pendingCandidates.push(candidate);
            return;
        }

        await this.#safeAddIceCandidate(session.pc, candidate);
    }

    async #safeAddIceCandidate(pc, candidate) {
        try {
            await pc.addIceCandidate(candidate);
        } catch (err) {
            console.warn('[WebRTC] Не удалось добавить ICE-кандидат:', err?.message || err);
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
            console.log(
                `[WebRTC] DataChannel открыт: peerId=${session.peerId}, user=${session.login} (${session.role})`
            );
        };

        channel.onclose = () => {
            if (session.dataChannel === channel) {
                session.dataChannel = null;
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
            const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);

            try {
                const parsed = JSON.parse(text);
                if (parsed && parsed.type === CHANNEL_TYPES.PING && channel.readyState === 'open') {
                    channel.send(JSON.stringify(createPongPayload(parsed.ts)));
                }
            } catch {
                // Игнорируем некорректные кадры от клиента
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
            // Игнорируем ошибки при закрытии уже закрытого канала
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
                pc.onconnectionstatechange = null;
                pc.oniceconnectionstatechange = null;
                pc.close();
            } catch {
                // Игнорируем ошибки при закрытии уже закрытого соединения
            }
        }

        session.pendingCandidates = [];
        session.remoteDescriptionSet = false;
    }

    removePeer(peerId) {
        const session = this.sessions.get(peerId);
        if (!session) {
            return;
        }

        this.sessions.delete(peerId);
        if (session.wsClient) {
            this.clientToPeerId.delete(session.wsClient);
        }

        this.#cleanupPeerConnection(session);
    }

    closeAll() {
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
                // События мутации студентов отправляются строго авторизованным клиентам с ролью ADMIN
                if (session.role !== 'ADMIN') {
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
