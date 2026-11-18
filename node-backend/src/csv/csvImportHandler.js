import { Worker } from 'node:worker_threads';
import { config } from '../config.js';
import { readRawBody, sendJson } from '../http/httpUtils.js';
import { authenticateRequest } from '../security/jwtVerifier.js';

const MAX_CSV_BYTES = 10 * 1024 * 1024;

function extractCsvText(rawBody, contentType = '') {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
        return rawBody;
    }

    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const parts = rawBody.split(`--${boundary}`);

    for (const part of parts) {
        if (part.includes('Content-Disposition:') && part.includes('filename=')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
                let content = part.slice(headerEnd + 4);
                if (content.endsWith('\r\n')) {
                    content = content.slice(0, -2);
                }
                return content;
            }
        }
    }

    throw new Error('FILE_PART_NOT_FOUND');
}

function runCsvWorker(csvText) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./csvWorker.js', import.meta.url), {
            workerData: { csvText },
        });

        worker.once('message', resolve);
        worker.once('error', reject);
        worker.once('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`CSV worker exited with code ${code}`));
            }
        });
    });
}

function sortErrorsByLine(errors) {
    return [...errors].sort((a, b) => {
        const lineA = Number(a.match(/^Строка (\d+):/)?.[1] ?? Number.MAX_SAFE_INTEGER);
        const lineB = Number(b.match(/^Строка (\d+):/)?.[1] ?? Number.MAX_SAFE_INTEGER);
        return lineA - lineB;
    });
}

export async function handleCsvImport(req, res, searchParams) {
    const user = authenticateRequest(req);
    if (!user) {
        return sendJson(res, 401, { error: 'Unauthorized' });
    }
    if (user.role !== 'ADMIN') {
        return sendJson(res, 403, { error: 'Forbidden: ADMIN role required' });
    }

    const strategy = (searchParams.get('strategy') || 'SKIP').toUpperCase();

    let csvText;
    try {
        const rawBody = await readRawBody(req, MAX_CSV_BYTES);
        csvText = extractCsvText(rawBody, req.headers['content-type'] || '');
    } catch (err) {
        if (err.message === 'PAYLOAD_TOO_LARGE') {
            return sendJson(res, 413, { error: 'Файл слишком большой (максимум 10 МБ)' });
        }
        return sendJson(res, 400, { error: 'Не удалось прочитать CSV-файл из запроса' });
    }

    const parsed = await runCsvWorker(csvText);
    const errors = [...parsed.errors];
    let saved = 0;
    let updated = 0;
    let failed = parsed.errors.length;

    const javaStudentsUrl = `${config.javaBackendUrl}/students`;
    const authHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${user.rawToken}`,
        'X-Action-Source': 'CSV_IMPORT',
    };

    for (const { lineNumber, student } of parsed.validRows) {
        try {
            const createRes = await fetch(javaStudentsUrl, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(student),
            });

            if (createRes.ok) {
                saved++;
                continue;
            }

            const errText = await createRes.text();
            const isDuplicate =
                createRes.status === 409 ||
                /already exists|уже существует|duplicate|unique/i.test(errText);

            if (isDuplicate) {
                if (strategy === 'OVERWRITE') {
                    const updateRes = await fetch(`${javaStudentsUrl}/${student.isuId}`, {
                        method: 'PATCH',
                        headers: authHeaders,
                        body: JSON.stringify(student),
                    });

                    if (updateRes.ok) {
                        updated++;
                    } else {
                        failed++;
                        errors.push(`Строка ${lineNumber}: не удалось обновить студента ${student.isuId} (код ${updateRes.status})`);
                    }
                } else {
                    failed++;
                    errors.push(`Строка ${lineNumber}: номер ИСУ ${student.isuId} уже существует`);
                }
            } else {
                failed++;
                let cleanMsg = `ошибка сохранения (код ${createRes.status})`;
                try {
                    const jsonErr = JSON.parse(errText);
                    if (jsonErr.message || jsonErr.error) {
                        cleanMsg = jsonErr.message || jsonErr.error;
                    }
                } catch {
                }
                errors.push(`Строка ${lineNumber}: ${cleanMsg}`);
            }
        } catch {
            failed++;
            errors.push(`Строка ${lineNumber}: ошибка связи с сервером приложений`);
        }
    }

    return sendJson(res, 200, {
        totalRows: parsed.totalRows,
        saved,
        updated,
        failed,
        errors: sortErrorsByLine(errors),
    });
}
