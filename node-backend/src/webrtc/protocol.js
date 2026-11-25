export const CHANNEL_TYPES = Object.freeze({
    STUDENT_EVENT: 'STUDENT_EVENT',
    CSV_PROGRESS: 'CSV_PROGRESS',
    PING: 'PING',
    PONG: 'PONG',
});

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
