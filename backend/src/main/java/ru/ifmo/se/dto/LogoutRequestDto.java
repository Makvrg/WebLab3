package ru.ifmo.se.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LogoutRequestDto {

    private String accessToken;

    @NotNull(message = "ID refresh-токена не может быть пустым")
    private Integer refreshTokenId;

    @NotBlank(message = "Refresh token не может быть пустым")
    private String refreshToken;
}
