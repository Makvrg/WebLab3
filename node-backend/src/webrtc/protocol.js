export const SIGNAL_TYPES = Object.freeze({
    WELCOME: 'welcome',
    OFFER: 'offer',
    ANSWER: 'answer',
    CANDIDATE: 'candidate',
    ERROR: 'error',
});

export const CHANNEL_TYPES = Object.freeze({
    STUDENT_EVENT: 'STUDENT_EVENT',
    CSV_PROGRESS: 'CSV_PROGRESS',
    PING: 'PING',
    PONG: 'PONG',
});

export function parseSignalMessage(rawText) {
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch {
        throw new Error('Некорректный JSON в сигнальном сообщении');
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Сигнальное сообщение должно быть JSON-объектом');
    }

    switch (parsed.type) {
        case SIGNAL_TYPES.OFFER: {
            if (typeof parsed.sdp !== 'string' || parsed.sdp.trim().length === 0) {
                throw new Error('Поле sdp обязательно для сообщения offer');
            }
            return {
                type: SIGNAL_TYPES.OFFER,
                sdp: parsed.sdp,
            };
        }

        case SIGNAL_TYPES.CANDIDATE: {
            if (
                parsed.candidate === null ||
                typeof parsed.candidate !== 'object' ||
                Array.isArray(parsed.candidate) ||
                typeof parsed.candidate.candidate !== 'string'
            ) {
                throw new Error('Некорректный объект candidate в сигнальном сообщении');
            }
            return {
                type: SIGNAL_TYPES.CANDIDATE,
                candidate: parsed.candidate,
            };
        }

        default:
            throw new Error(`Неподдерживаемый тип сигнального сообщения: ${String(parsed.type)}`);
    }
}

export function createWelcomeMessage(peerId, role) {
    return {
        type: SIGNAL_TYPES.WELCOME,
        peerId,
        role,
    };
}

export function createAnswerMessage(sdp) {
    return {
        type: SIGNAL_TYPES.ANSWER,
        sdp,
    };
}

export function createCandidateMessage(candidate) {
    return {
        type: SIGNAL_TYPES.CANDIDATE,
        candidate,
    };
}

export function createErrorMessage(message, code = 'SIGNAL_ERROR') {
    return {
        type: SIGNAL_TYPES.ERROR,
        code,
        message,
    };
}

export function createStudentEventPayload(auditEvent) {
    return {
        type: CHANNEL_TYPES.STUDENT_EVENT,
        eventId: auditEvent.eventId,
        timestamp: auditEvent.timestamp,
        action: auditEvent.action,
        source: auditEvent.source,
        actor: auditEvent.actor,
        isuId: auditEvent.isuId,
        before: auditEvent.before ?? null,
        after: auditEvent.after ?? null,
    };
}

export function createCsvProgressPayload(progressEvent) {
    return {
        type: CHANNEL_TYPES.CSV_PROGRESS,
        userId: progressEvent.userId,
        jobId: progressEvent.jobId,
        status: progressEvent.status,
        total: progressEvent.total,
        processed: progressEvent.processed,
        created: progressEvent.created,
        skipped: progressEvent.skipped,
        errors: Array.isArray(progressEvent.errors) ? progressEvent.errors : [],
    };
}

export function createPongPayload(ts = Date.now()) {
    return {
        type: CHANNEL_TYPES.PONG,
        ts,
    };
}
