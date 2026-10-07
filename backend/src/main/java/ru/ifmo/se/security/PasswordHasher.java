package ru.ifmo.se.security;

import jakarta.enterprise.context.ApplicationScoped;
import ru.ifmo.se.exceptions.ServerException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

@ApplicationScoped
public class PasswordHasher {

    private static final int SALT_BYTES = 16;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String pepper;

    public PasswordHasher() {
        String envPepper = System.getenv("PASSWORD_PEPPER");
        this.pepper = (envPepper != null && !envPepper.isBlank())
                ? envPepper
                : "super-secret-pepper-weblab3-itmo-2026";
    }

    public String generateSalt() {
        byte[] salt = new byte[SALT_BYTES];
        secureRandom.nextBytes(salt);
        return Base64.getEncoder().encodeToString(salt);
    }

    public String hash(String rawValue, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(salt.getBytes(StandardCharsets.UTF_8));
            digest.update(pepper.getBytes(StandardCharsets.UTF_8));
            byte[] hashedBytes = digest.digest(rawValue.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashedBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new ServerException("Ошибка алгоритма хеширования SHA-256", e);
        }
    }

    public boolean verify(String rawValue, String salt, String expectedHash) {
        if (rawValue == null || salt == null || expectedHash == null) {
            return false;
        }
        String actualHash = hash(rawValue, salt);
        return MessageDigest.isEqual(
                actualHash.getBytes(StandardCharsets.UTF_8),
                expectedHash.getBytes(StandardCharsets.UTF_8)
        );
    }

    public String generateRandomToken() {
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }
}