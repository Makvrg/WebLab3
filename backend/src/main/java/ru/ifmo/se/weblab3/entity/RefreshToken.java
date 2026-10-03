package ru.ifmo.se.weblab3.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.time.ZonedDateTime;

@Getter
@Setter
@AllArgsConstructor
public class RefreshToken {

    private Integer refresh_token_id;
    private Integer user_id;
    private String hashed_token;
    private ZonedDateTime expires_at;
    private ZonedDateTime created_at;

    @Override
    public String toString() {
        return "RefreshToken{" +
                "refresh_token_id=" + refresh_token_id +
                ", user_id=" + user_id +
                ", expires_at=" + expires_at +
                ", created_at=" + created_at +
                '}';
    }
}
