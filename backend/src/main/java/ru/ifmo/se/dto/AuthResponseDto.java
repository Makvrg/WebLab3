package ru.ifmo.se.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponseDto {
    private String accessToken;
    private String refreshToken; // Соответствует полю hashedToken в RefreshToken Entity[cite: 8]
    private String role; // Возвращаем роль, чтобы фронтенд сохранил её в localStorage[cite: 8]
}