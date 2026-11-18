import crypto from 'node:crypto';
import { config } from '../config.js';

export class AuthError extends Error {
    constructor(message, statusCode = 401) {
        super(message);
        this.name = 'AuthError';
        this.statusCode = statusCode;
    }
}

export function parseCookies(cookieHeader) {
    if (!cookieHeader || typeof cookieHeader !== 'string') {
        return {};
    }

    const cookies = {};
    const pairs = cookieHeader.split(';');

    for (const pair of pairs) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex <= 0) {
            continue;
        }

        const key = pair.slice(0, eqIndex).trim();
        const rawValue = pair.slice(eqIndex + 1).trim();

        if (!key) {
            continue;
        }

        try {
            cookies[key] = decodeURIComponent(rawValue);
        } catch {
            cookies[key] = rawValue;
        }
    }

    return cookies;
}

export function extractTokenFromRequest(req) {
    const cookies = parseCookies(req.headers?.cookie);
    if (typeof cookies.accessToken === 'string' && cookies.accessToken.trim().length > 0) {
        return cookies.accessToken.trim();
    }

    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string') {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match && match[1].trim().length > 0) {
            return match[1].trim();
        }
    }

    return null;
}

function decodeBase64UrlJson(segment, errorMessage) {
    let parsed;
    try {
        const json = Buffer.from(segment, 'base64url').toString('utf8');
        parsed = JSON.parse(json);
    } catch {
        throw new AuthError(errorMessage, 401);
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AuthError(errorMessage, 401);
    }

    return parsed;
}

export function verifyAccessToken(token) {
    if (!token || typeof token !== 'string') {
        throw new AuthError('Токен аутентификации отсутствует', 401);
    }

    const secret = config?.jwtSecret || process.env.JWT_SECRET;
    if (!secret || typeof secret !== 'string') {
        throw new AuthError('JWT_SECRET не задан в переменных окружения', 500);
    }

    const parts = token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        throw new AuthError('Некорректный формат JWT токена', 401);
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeBase64UrlJson(encodedHeader, 'Не удалось декодировать заголовок JWT');

    if (header.alg !== 'HS256') {
        throw new AuthError('Неподдерживаемый алгоритм подписи JWT', 401);
    }

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(unsignedToken)
        .digest('base64url');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(encodedSignature, 'utf8');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        throw new AuthError('Недействительная подпись JWT токена', 401);
    }

    const payload = decodeBase64UrlJson(encodedPayload, 'Не удалось декодировать полезную нагрузку JWT');

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        throw new AuthError('В токене отсутствует корректное время истечения (exp)', 401);
    }

    if (payload.exp * 1000 <= Date.now()) {
        throw new AuthError('Срок действия токена истёк', 401);
    }

    if (!Number.isInteger(payload.userId) || payload.userId <= 0) {
        throw new AuthError('Некорректный userId в токене', 401);
    }

    const resolvedLogin = typeof payload.login === 'string' ? payload.login : payload.sub;
    if (typeof resolvedLogin !== 'string' || resolvedLogin.trim().length === 0) {
        throw new AuthError('Некорректный login в токене', 401);
    }

    if (payload.role !== 'USER' && payload.role !== 'ADMIN') {
        throw new AuthError('Некорректная роль пользователя в токене', 401);
    }

    return {
        rawToken: token,
        userId: payload.userId,
        login: resolvedLogin,
        role: payload.role,
        exp: payload.exp,
    };
}

export function verifyJwt(token) {
    if (!token) {
        return null;
    }

    try {
        return verifyAccessToken(token);
    } catch {
        return null;
    }
}

export function authenticateRequest(req) {
    const token = extractTokenFromRequest(req);
    return verifyJwt(token);
}
