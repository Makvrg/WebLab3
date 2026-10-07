package ru.ifmo.se.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TokenRefreshRequestDto {
    @NotBlank(message = "Refresh token не может быть пустым")
    private String refreshToken; // Строка токена, которую присылает клиент
}