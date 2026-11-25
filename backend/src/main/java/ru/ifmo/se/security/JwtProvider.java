package ru.ifmo.se.security;

import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.ifmo.se.entity.Role;
import ru.ifmo.se.entity.User;
import ru.ifmo.se.exceptions.ServerException;
import ru.ifmo.se.exceptions.UnauthorizedException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@ApplicationScoped
public class JwtProvider {

    private static final String RSA_ALGO = "RSA";
    private static final String SIGN_ALGO = "SHA256withRSA";
    private static final String EXPECTED_ALG = "RS256";
    private static final String HEADER_JSON = "{\"alg\":\"RS256\",\"typ\":\"JWT\"}";
    private static final long ACCESS_EXP_MINUTES = 15;
    private static final int JWT_PARTS_COUNT = 3;
    private static final int MIN_LOGIN_LENGTH = 3;
    private static final int MAX_LOGIN_LENGTH = 50;

    private static final String ENV_PRIVATE_KEY_PATH = "JWT_PRIVATE_KEY_PATH";
    private static final String ENV_PRIVATE_KEY = "JWT_PRIVATE_KEY";
    private static final String ENV_PUBLIC_KEY_PATH = "JWT_PUBLIC_KEY_PATH";
    private static final String ENV_PUBLIC_KEY = "JWT_PUBLIC_KEY";

    private static final String PRIVATE_KEY_BEGIN = "-----BEGIN PRIVATE KEY-----";
    private static final String PRIVATE_KEY_END = "-----END PRIVATE KEY-----";
    private static final String PUBLIC_KEY_BEGIN = "-----BEGIN PUBLIC KEY-----";
    private static final String PUBLIC_KEY_END = "-----END PUBLIC KEY-----";

    private final PrivateKey privateKey;
    private final PublicKey publicKey;
    private final Jsonb jsonb = JsonbBuilder.create();

    public JwtProvider() {
        String privatePem = loadPem(ENV_PRIVATE_KEY_PATH, ENV_PRIVATE_KEY, "приватный ключ JWT");
        String publicPem = loadPem(ENV_PUBLIC_KEY_PATH, ENV_PUBLIC_KEY, "публичный ключ JWT");
        this.privateKey = parsePrivateKey(privatePem);
        this.publicKey = parsePublicKey(publicPem);
    }

    @PreDestroy
    void destroy() {
        try {
            jsonb.close();
        } catch (Exception ignored) {
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenPayload {
        private Integer userId;
        private String login;
        private String role;
        private long exp;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    private static class TokenHeader {
        private String alg;
        private String typ;
    }

    public String createAccessToken(User user) {
        long exp = Instant.now().plus(ACCESS_EXP_MINUTES, ChronoUnit.MINUTES).getEpochSecond();
        TokenPayload payload = new TokenPayload(
                user.getUserId(),
                user.getLogin(),
                user.getRole().name(),
                exp
        );
        return buildJwt(payload);
    }

    public TokenPayload checkAccessToken(String token) {
        if (token == null || token.isBlank()) {
            throw new UnauthorizedException("Токен отсутствует");
        }

        String[] parts = token.split("\\.");
        if (parts.length != JWT_PARTS_COUNT || parts[0].isBlank() || parts[1].isBlank() || parts[2].isBlank()) {
            throw new UnauthorizedException("Некорректный формат JWT токена");
        }

        TokenHeader header;
        try {
            String headerJson = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            header = jsonb.fromJson(headerJson, TokenHeader.class);
        } catch (Exception e) {
            throw new UnauthorizedException("Не удалось прочитать заголовок JWT токена");
        }

        if (header == null || !EXPECTED_ALG.equals(header.getAlg())) {
            throw new UnauthorizedException("Неподдерживаемый алгоритм подписи JWT");
        }

        byte[] signatureBytes;
        try {
            signatureBytes = Base64.getUrlDecoder().decode(parts[2]);
        } catch (IllegalArgumentException e) {
            throw new UnauthorizedException("Некорректный формат подписи JWT токена");
        }

        String unsignedToken = parts[0] + "." + parts[1];
        boolean signatureValid;
        try {
            Signature verifier = Signature.getInstance(SIGN_ALGO);
            verifier.initVerify(publicKey);
            verifier.update(unsignedToken.getBytes(StandardCharsets.UTF_8));
            signatureValid = verifier.verify(signatureBytes);
        } catch (Exception e) {
            signatureValid = false;
        }

        if (!signatureValid) {
            throw new UnauthorizedException("Недействительная подпись JWT токена");
        }

        TokenPayload payload;
        try {
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            payload = jsonb.fromJson(payloadJson, TokenPayload.class);
        } catch (Exception e) {
            throw new UnauthorizedException("Не удалось прочитать данные токена");
        }

        if (payload == null || payload.getUserId() == null || payload.getUserId() < 0) {
            throw new UnauthorizedException("Некорректный id юзера");
        }

        if (payload.getLogin() == null || payload.getLogin().isBlank() ||
                payload.getLogin().length() < MIN_LOGIN_LENGTH || payload.getLogin().length() > MAX_LOGIN_LENGTH) {
            throw new UnauthorizedException("Некорректный логин в токене");
        }

        if (payload.getExp() < Instant.now().getEpochSecond()) {
            throw new UnauthorizedException("Срок действия токена истек");
        }

        try {
            Role.valueOf(payload.getRole());
        } catch (Exception e) {
            throw new UnauthorizedException("Некорректная роль в токене");
        }

        return payload;
    }

    private String buildJwt(TokenPayload payload) {
        String encodedHeader = base64UrlEncode(HEADER_JSON.getBytes(StandardCharsets.UTF_8));
        String payloadJson = jsonb.toJson(payload);
        String encodedPayload = base64UrlEncode(payloadJson.getBytes(StandardCharsets.UTF_8));

        String unsignedToken = encodedHeader + "." + encodedPayload;
        String signature = sign(unsignedToken);

        return unsignedToken + "." + signature;
    }

    private String sign(String data) {
        try {
            Signature signer = Signature.getInstance(SIGN_ALGO);
            signer.initSign(privateKey);
            signer.update(data.getBytes(StandardCharsets.UTF_8));
            return base64UrlEncode(signer.sign());
        } catch (Exception e) {
            throw new ServerException("Ошибка при подписи JWT", e);
        }
    }

    private static String loadPem(String pathEnvName, String inlineEnvName, String keyLabel) {
        String keyPath = System.getenv(pathEnvName);
        if (keyPath != null && !keyPath.isBlank()) {
            Path path = Path.of(keyPath.trim());
            try {
                String pem = Files.readString(path, StandardCharsets.UTF_8);
                if (pem.isBlank()) {
                    throw new IllegalStateException("Файл с " + keyLabel + " пуст: " + path);
                }
                return pem;
            } catch (IOException e) {
                throw new IllegalStateException("Не удалось прочитать " + keyLabel + " из файла: " + path, e);
            }
        }

        String inlinePem = System.getenv(inlineEnvName);
        if (inlinePem != null && !inlinePem.isBlank()) {
            return inlinePem.replace("\\n", "\n");
        }

        throw new IllegalStateException(
                "Не задан " + keyLabel + " (проверьте " + pathEnvName + " или " + inlineEnvName + ")"
        );
    }

    private static PrivateKey parsePrivateKey(String pem) {
        try {
            String normalized = pem
                    .replace(PRIVATE_KEY_BEGIN, "")
                    .replace(PRIVATE_KEY_END, "")
                    .replaceAll("\\s+", "");
            byte[] der = Base64.getDecoder().decode(normalized);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(der);
            return KeyFactory.getInstance(RSA_ALGO).generatePrivate(spec);
        } catch (Exception e) {
            throw new IllegalStateException("Некорректный формат приватного RSA-ключа JWT (ожидается PKCS#8 PEM)", e);
        }
    }

    private static PublicKey parsePublicKey(String pem) {
        try {
            String normalized = pem
                    .replace(PUBLIC_KEY_BEGIN, "")
                    .replace(PUBLIC_KEY_END, "")
                    .replaceAll("\\s+", "");
            byte[] der = Base64.getDecoder().decode(normalized);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(der);
            return KeyFactory.getInstance(RSA_ALGO).generatePublic(spec);
        } catch (Exception e) {
            throw new IllegalStateException("Некорректный формат публичного RSA-ключа JWT (ожидается X.509/SPKI PEM)", e);
        }
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
