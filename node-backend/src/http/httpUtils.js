export function readRawBody(req, maxBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalBytes = 0;

        req.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
                req.destroy();
                reject(new Error('PAYLOAD_TOO_LARGE'));
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });

        req.on('error', (err) => reject(err));
    });
}

export async function readJsonBody(req, maxBytes = 1024 * 1024) {
    const raw = await readRawBody(req, maxBytes);
    if (!raw.trim()) return null;
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error('INVALID_JSON');
    }
}

export function sendJson(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}
