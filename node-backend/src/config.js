export const config = {
    port: Number(process.env.NODE_BACKEND_PORT || 4000),
    javaBackendUrl: process.env.JAVA_BACKEND_URL,
    auditFilePath: process.env.AUDIT_FILE_PATH,
    jwtSecret: process.env.JWT_SECRET,
    internalApiSecret: process.env.INTERNAL_API_SECRET,
    corsOrigin: process.env.CORS_ORIGIN,
};
