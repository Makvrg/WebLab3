import crypto from 'node:crypto';
import { config } from '../config.js';

export function extractTokenFromRequest(req) {
    const cookieHeader = req.headers.cookie || '';
    for (const part of cookieHeader.split(';')) {
        const [key, ...valParts] = part.trim().split('=');
        if (key === 'accessToken') {
            return decodeURIComponent(valParts.join('='));
        }
    }

    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    return null;
}

export function verifyJwt(token) {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const expectedSignature = crypto
        .createHmac('sha256', config.jwtSecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

    const actualBuf = Buffer.from(signatureB64);
    const expectedBuf = Buffer.from(expectedSignature);

    if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
        return null;
    }

    try {
        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);

        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return null;
        }

        return {
            rawToken: token,
            userId: payload.userId,
            login: payload.sub,
            role: payload.role,
        };
    } catch {
        return null;
    }
}

export function authenticateRequest(req) {
    const token = extractTokenFromRequest(req);
    return verifyJwt(token);
}
