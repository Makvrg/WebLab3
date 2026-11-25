import crypto from 'node:crypto';
import { config } from '../config.js';

const EXPECTED_ALG = 'RS256';
const RSA_SIGNATURE_ALGO = 'RSA-SHA256';
const JWT_PARTS_COUNT = 3;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MS_PER_SECOND = 1000;
const ALLOWED_ROLES = new Set(['USER', 'ADMIN']);

const HTTP_UNAUTHORIZED = 401;
const HTTP_INTERNAL_SERVER_ERROR = 500;

export class AuthError extends Error {
    constructor(message, statusCode = HTTP_UNAUTHORIZED) {
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
        throw new AuthError(errorMessage, HTTP_UNAUTHORIZED);
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AuthError(errorMessage, HTTP_UNAUTHORIZED);
    }

    return parsed;
}

let cachedPem = null;
let cachedPublicKeyObject = null;

function getPublicKeyObject() {
    const pem =
        config?.jwtPublicKey ||
        (process.env.JWT_PUBLIC_KEY
            ? process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n')
            : null);

    if (!pem || typeof pem !== 'string' || pem.trim().length === 0) {
        throw new AuthError('Публичный ключ JWT не задан в переменных окружения', HTTP_INTERNAL_SERVER_ERROR);
    }

    if (cachedPublicKeyObject && cachedPem === pem) {
        return cachedPublicKeyObject;
    }

    try {
        cachedPublicKeyObject = crypto.createPublicKey(pem);
        cachedPem = pem;
        return cachedPublicKeyObject;
    } catch {
        throw new AuthError('Некорректный публичный ключ JWT', HTTP_INTERNAL_SERVER_ERROR);
    }
}

export function verifyAccessToken(token) {
    if (!token || typeof token !== 'string') {
        throw new AuthError('Токен аутентификации отсутствует', HTTP_UNAUTHORIZED);
    }

    const publicKeyObject = getPublicKeyObject();

    const parts = token.split('.');
    if (parts.length !== JWT_PARTS_COUNT || !parts[0] || !parts[1] || !parts[2]) {
        throw new AuthError('Некорректный формат JWT токена', HTTP_UNAUTHORIZED);
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeBase64UrlJson(encodedHeader, 'Не удалось декодировать заголовок JWT');

    if (header.alg !== EXPECTED_ALG) {
        throw new AuthError('Неподдерживаемый алгоритм подписи JWT', HTTP_UNAUTHORIZED);
    }

    if (!BASE64URL_PATTERN.test(encodedSignature)) {
        throw new AuthError('Недействительная подпись JWT токена', HTTP_UNAUTHORIZED);
    }

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    let isSignatureValid = false;
    try {
        isSignatureValid = crypto.verify(
            RSA_SIGNATURE_ALGO,
            Buffer.from(unsignedToken, 'utf8'),
            publicKeyObject,
            Buffer.from(encodedSignature, 'base64url')
        );
    } catch {
        isSignatureValid = false;
    }

    if (!isSignatureValid) {
        throw new AuthError('Недействительная подпись JWT токена', HTTP_UNAUTHORIZED);
    }

    const payload = decodeBase64UrlJson(encodedPayload, 'Не удалось декодировать полезную нагрузку JWT');

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        throw new AuthError('В токене отсутствует корректное время истечения (exp)', HTTP_UNAUTHORIZED);
    }

    if (payload.exp * MS_PER_SECOND <= Date.now()) {
        throw new AuthError('Срок действия токена истёк', HTTP_UNAUTHORIZED);
    }

    if (!Number.isInteger(payload.userId) || payload.userId <= 0) {
        throw new AuthError('Некорректный userId в токене', HTTP_UNAUTHORIZED);
    }

    const resolvedLogin = typeof payload.login === 'string' ? payload.login : payload.sub;
    if (typeof resolvedLogin !== 'string' || resolvedLogin.trim().length === 0) {
        throw new AuthError('Некорректный login в токене', HTTP_UNAUTHORIZED);
    }

    if (!ALLOWED_ROLES.has(payload.role)) {
        throw new AuthError('Некорректная роль пользователя в токене', HTTP_UNAUTHORIZED);
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
