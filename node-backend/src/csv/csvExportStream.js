import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';
import { authenticateRequest } from '../security/jwtVerifier.js';
import { sendJson } from '../http/httpUtils.js';

const CSV_COLUMNS = [
    { key: 'isuId', header: 'isuId' },
    { key: 'fio', header: 'fio' },
    { key: 'stGroup', header: 'stGroup' },
    { key: 'dormitoryNumber', header: 'dormitoryNumber' },
    { key: 'room', header: 'room' },
    { key: 'dateOfPlacement', header: 'dateOfPlacement' },
    { key: 'isNotRussian', header: 'isNotRussian' },
    { key: 'notes', header: 'notes' },
];

function escapeCsvCell(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function buildFilterParams(searchParams) {
    const params = new URLSearchParams();
    const allowedKeys = [
        'isuId',
        'fio',
        'stGroup',
        'dormitoryNumber',
        'room',
        'dateOfPlacement',
        'isNotRussian',
    ];

    for (const key of allowedKeys) {
        const val = searchParams.get(key);
        if (val !== null && val.trim() !== '') {
            params.set(key, val.trim());
        }
    }
    return params;
}

async function* fetchStudentsGenerator(rawToken, filterParams) {
    // Проверь в StudentService.java: если формула offset = (pageNumber - 1) * pageSize, поставь 1
    let pageNumber = 1;
    const pageSize = 100;
    let previousFirstId = null;

    while (true) {
        const url = new URL(`${config.javaBackendUrl}/students`);
        for (const [key, val] of filterParams.entries()) {
            url.searchParams.set(key, val);
        }
        url.searchParams.set('pageNumber', String(pageNumber));
        url.searchParams.set('pageSize', String(pageSize));

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${rawToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`JAVA_FETCH_FAILED_${response.status}`);
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.content || []);

        if (items.length === 0) {
            break;
        }

        if (items[0]?.isuId !== undefined && items[0].isuId === previousFirstId) {
            break;
        }
        previousFirstId = items[0]?.isuId ?? null;

        for (const student of items) {
            yield student;
        }

        pageNumber += 1;
    }
}

function createCsvTransformStream(res) {
    let isHeaderWritten = false;
    const headerLine = '\uFEFF' + CSV_COLUMNS.map((c) => c.header).join(',') + '\r\n';

    const ensureHeaders = () => {
        if (isHeaderWritten) return '';
        res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="students_export.csv"',
            'Cache-Control': 'no-cache',
        });
        isHeaderWritten = true;
        return headerLine;
    };

    return new Transform({
        writableObjectMode: true,

        transform(student, _encoding, callback) {
            try {
                const prefix = ensureHeaders();
                const row = CSV_COLUMNS.map((col) => escapeCsvCell(student[col.key])).join(',');
                callback(null, prefix + row + '\r\n');
            } catch (err) {
                callback(err);
            }
        },

        flush(callback) {
            const prefix = ensureHeaders();
            if (prefix) {
                this.push(prefix);
            }
            callback();
        },
    });
}

export async function handleCsvExport(req, res, searchParams) {
    const user = authenticateRequest(req);
    if (!user) {
        return sendJson(res, 401, { error: 'Unauthorized' });
    }

    const filterParams = buildFilterParams(searchParams);

    try {
        const sourceStream = Readable.from(fetchStudentsGenerator(user.rawToken, filterParams));
        const csvTransform = createCsvTransformStream(res);

        await pipeline(sourceStream, csvTransform, res);
    } catch (err) {
        console.error('[CSV Export Error]', err);
        if (!res.headersSent) {
            return sendJson(res, 502, { error: 'Не удалось выгрузить студентов с Java-сервера' });
        }
        res.destroy(err);
    }
}
