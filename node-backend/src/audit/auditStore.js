import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { config } from '../config.js';
import { appEvents } from '../events.js';

const seenEventIds = new Set();
const records = [];

export async function initAuditStore() {
    const dir = path.dirname(config.auditFilePath);
    await fsp.mkdir(dir, { recursive: true });

    if (!fs.existsSync(config.auditFilePath)) {
        await fsp.writeFile(config.auditFilePath, '', 'utf8');
        console.log(`[AuditStore] Создан новый файл журнала: ${config.auditFilePath}`);
        return;
    }

    const fileStream = fs.createReadStream(config.auditFilePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const event = JSON.parse(line);
            if (event.eventId && !seenEventIds.has(event.eventId)) {
                seenEventIds.add(event.eventId);
                records.push(event);
            }
        } catch {
            console.warn('[AuditStore] Пропущена повреждённая строка в файле журнала');
        }
    }

    console.log(`[AuditStore] Загружено записей из файла при старте: ${records.length}`);
}

export async function appendAuditEvent(event) {
    if (!event || !event.eventId) {
        throw new Error('INVALID_EVENT');
    }

    if (seenEventIds.has(event.eventId)) {
        return { duplicate: true };
    }

    seenEventIds.add(event.eventId);
    try {
        const line = JSON.stringify(event) + '\n';
        await fsp.appendFile(config.auditFilePath, line, 'utf8');
    } catch (err) {
        seenEventIds.delete(event.eventId);
        throw err;
    }

    records.push(event);

    appEvents.emit('audit:created', event);

    return { duplicate: false };
}

export function getAuditEvents({ page = 1, size = 20, action, source, isuId, actorLogin }) {
    let filtered = [...records].reverse();

    if (action) {
        filtered = filtered.filter((r) => r.action === action);
    }
    if (source) {
        filtered = filtered.filter((r) => r.source === source);
    }
    if (isuId) {
        filtered = filtered.filter((r) => String(r.isuId).includes(String(isuId)));
    }
    if (actorLogin) {
        const q = actorLogin.toLowerCase();
        filtered = filtered.filter((r) => r.actor?.login?.toLowerCase().includes(q));
    }

    const safePage = Math.max(1, Number(page) || 1);
    const totalElements = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / size));
    const start = (safePage - 1) * size;
    const content = filtered.slice(start, start + size);

    return {
        content,
        page: safePage,
        size,
        totalElements,
        totalPages,
    };
}
