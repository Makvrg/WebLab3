import process from 'node:process';

export const config = {
    port: Number(process.env.PORT || process.env.NODE_BACKEND_PORT || 4000),
    javaBackendUrl: process.env.JAVA_BACKEND_URL || 'http://backend:8080',
    auditFilePath: process.env.AUDIT_FILE_PATH || './data/audit.ndjson',
    jwtSecret: process.env.JWT_SECRET,
    internalApiSecret: process.env.INTERNAL_API_SECRET,
    corsOrigin: process.env.CORS_ORIGIN,
    webrtcPublicIp: process.env.WEBRTC_PUBLIC_IP || '',
    webrtcPortMin: Number(process.env.WEBRTC_PORT_MIN || 40000),
    webrtcPortMax: Number(process.env.WEBRTC_PORT_MAX || 40050),
};
