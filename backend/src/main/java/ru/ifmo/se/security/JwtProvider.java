package ru.ifmo.se.security;

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

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@ApplicationScoped
public class JwtProvider {

    private static final String HMAC_ALGO = "HmacSHA256";
    private static final String HEADER_JSON = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
    private static final long ACCESS_EXP_MINUTES = 15;

    private final String secretKey;
    private final Jsonb jsonb = JsonbBuilder.create();

    public JwtProvider() {
        this.secretKey = "super-secret-jwt-key-for-weblab3-itmo-2026";
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
        if (parts.length != 3) {
            throw new UnauthorizedException("Некорректный формат JWT токена");
        }

        String unsignedToken = parts[0] + "." + parts[1];
        String expectedSignature = sign(unsignedToken);

        if (!MessageDigest.isEqual(
                expectedSignature.getBytes(StandardCharsets.UTF_8),
                parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw new UnauthorizedException("Недействительная подпись JWT токена");
        }

        TokenPayload payload;
        try {
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            payload = jsonb.fromJson(payloadJson, TokenPayload.class);
        } catch (Exception e) {
            throw new UnauthorizedException("Не удалось прочитать данные токена");
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
            Mac mac = Mac.getInstance(HMAC_ALGO);
            SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), HMAC_ALGO);
            mac.init(keySpec);
            byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return base64UrlEncode(rawHmac);
        } catch (Exception e) {
            throw new ServerException("Ошибка при подписи JWT", e);
        }
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}