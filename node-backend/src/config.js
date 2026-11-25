import fs from 'node:fs';
import process from 'node:process';

const DEFAULT_WEBRTC_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
];

function loadJwtPublicKey() {
    const keyPath = process.env.JWT_PUBLIC_KEY_PATH;
    if (keyPath && keyPath.trim().length > 0) {
        return fs.readFileSync(keyPath.trim(), 'utf8');
    }
    if (process.env.JWT_PUBLIC_KEY && process.env.JWT_PUBLIC_KEY.trim().length > 0) {
        return process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
    }
    return null;
}

function parseWebRtcIceServers() {
    const raw = process.env.WEBRTC_ICE_SERVERS;
    if (!raw || raw.trim().length === 0) {
        return DEFAULT_WEBRTC_ICE_SERVERS;
    }

    try {
        const parsed = JSON.parse(raw);
        if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.every((item) => item && typeof item === 'object' && 'urls' in item)
        ) {
            return parsed;
        }
        console.warn('[Config] WEBRTC_ICE_SERVERS должен быть непустым JSON-массивом объектов с полем urls, используется дефолтный STUN');
    } catch (err) {
        console.warn('[Config] Не удалось распарсить WEBRTC_ICE_SERVERS, используется дефолтный STUN:', err?.message || err);
    }

    return DEFAULT_WEBRTC_ICE_SERVERS;
}

export const config = {
    port: Number(process.env.PORT),
    javaBackendUrl: process.env.JAVA_BACKEND_URL,
    jwtPublicKey: loadJwtPublicKey(),
    internalApiSecret: process.env.INTERNAL_API_SECRET,
    corsOrigin: process.env.CORS_ORIGIN,
    webrtcPublicIp: process.env.WEBRTC_PUBLIC_IP,
    webrtcPortMin: Number(process.env.WEBRTC_PORT_MIN),
    webrtcPortMax: Number(process.env.WEBRTC_PORT_MAX),
    webrtcIceServers: parseWebRtcIceServers(),
};
