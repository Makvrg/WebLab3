package ru.ifmo.se.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
public class RefreshToken {

    private Integer refreshTokenId;
    private Integer userId;
    private String hashedToken;
    private String salt;
    private OffsetDateTime expiresAt;
    private OffsetDateTime createdAt;

    @Override
    public String toString() {
        return "RefreshToken{" +
                "refreshTokenId=" + refreshTokenId +
                ", userId=" + userId +
                ", expiresAt=" + expiresAt +
                ", createdAt=" + createdAt +
                '}';
    }
}
