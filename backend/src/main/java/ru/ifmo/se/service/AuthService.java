package ru.ifmo.se.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import ru.ifmo.se.dto.AuthResponseDto;
import ru.ifmo.se.dto.LogoutRequestDto;
import ru.ifmo.se.dto.TokenRefreshRequestDto;
import ru.ifmo.se.dto.UserLoginDto;
import ru.ifmo.se.dto.UserRegisterDto;
import ru.ifmo.se.entity.RefreshToken;
import ru.ifmo.se.entity.User;
import ru.ifmo.se.exceptions.NotUniqueIdException;
import ru.ifmo.se.exceptions.UnauthorizedException;
import ru.ifmo.se.exceptions.ValidationException;
import ru.ifmo.se.repository.RefreshTokenRepository;
import ru.ifmo.se.repository.UserRepository;
import ru.ifmo.se.security.JwtProvider;
import ru.ifmo.se.security.PasswordHasher;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class AuthService {

    private static final long REFRESH_EXP_DAYS = 7;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtProvider jwtProvider;
    private final PasswordHasher passwordHasher;
    private final Validator validator;

    @Inject
    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            JwtProvider jwtProvider,
            PasswordHasher passwordHasher,
            Validator validator
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtProvider = jwtProvider;
        this.passwordHasher = passwordHasher;
        this.validator = validator;
    }

    private <T> void validateDto(T dto) {
        if (dto == null) {
            throw new ValidationException("Тело запроса не может быть пустым");
        }
        Set<ConstraintViolation<T>> violations = validator.validate(dto);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(ConstraintViolation::getMessage)
                    .collect(Collectors.joining("; "));
            throw new ValidationException(message);
        }
    }

    public void register(UserRegisterDto registerDto) {
        validateDto(registerDto);

        if (userRepository.existsUserByLogin(registerDto.getLogin())) {
            throw new NotUniqueIdException("Пользователь с логином '" + registerDto.getLogin() + "' уже существует");
        }

        if (userRepository.existsUserByEmail(registerDto.getEmail())) {
            throw new NotUniqueIdException("Пользователь с email '" + registerDto.getEmail() + "' уже существует");
        }

        String salt = passwordHasher.generateSalt();
        String hashedPassword = passwordHasher.hash(registerDto.getPassword(), salt);

        User newUser = new User(
                null,
                registerDto.getLogin(),
                registerDto.getEmail(),
                registerDto.getRole(),
                hashedPassword,
                salt
        );

        userRepository.addUser(newUser);
    }

    public AuthResponseDto login(UserLoginDto loginDto) {
        validateDto(loginDto);

        User user = userRepository.getUserByLogin(loginDto.getLogin())
                .orElseThrow(() -> new UnauthorizedException("Неверный логин или пароль"));

        boolean passwordMatches = passwordHasher.verify(
                loginDto.getPassword(),
                user.getSalt(),
                user.getHashedPassword()
        );

        if (!passwordMatches) {
            throw new UnauthorizedException("Неверный логин или пароль");
        }

        return issueTokens(user);
    }

    public AuthResponseDto refresh(TokenRefreshRequestDto refreshDto) {
        validateDto(refreshDto);

        refreshTokenRepository.deleteTokensByExpired();

        RefreshToken storedToken = refreshTokenRepository.getTokenByTokenId(refreshDto.getRefreshTokenId())
                .orElseThrow(() -> new UnauthorizedException("Refresh-токен не найден или уже использован"));

        if (storedToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            refreshTokenRepository.deleteTokenByTokenId(storedToken.getRefreshTokenId());
            throw new UnauthorizedException("Срок действия refresh-токена истек");
        }

        boolean tokenMatches = passwordHasher.verify(
                refreshDto.getRefreshToken(),
                storedToken.getSalt(),
                storedToken.getHashedToken()
        );

        if (!tokenMatches) {
            throw new UnauthorizedException("Недействительный refresh-токен");
        }

        refreshTokenRepository.deleteTokenByTokenId(storedToken.getRefreshTokenId());

        User user = userRepository.getUserById(storedToken.getUserId())
                .orElseThrow(() -> new UnauthorizedException("Пользователь не найден"));

        return issueTokens(user);
    }

    public void logout(LogoutRequestDto logoutDto) {
        validateDto(logoutDto);

        refreshTokenRepository.getTokenByTokenId(logoutDto.getRefreshTokenId())
                .ifPresent(storedToken -> {
                    boolean matches = passwordHasher.verify(
                            logoutDto.getRefreshToken(),
                            storedToken.getSalt(),
                            storedToken.getHashedToken()
                    );
                    if (matches) {
                        refreshTokenRepository.deleteTokenByTokenId(storedToken.getRefreshTokenId());
                    }
                });
    }

    private AuthResponseDto issueTokens(User user) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusDays(REFRESH_EXP_DAYS);

        String accessToken = jwtProvider.createAccessToken(user);
        String rawRefreshToken = passwordHasher.generateRandomToken();

        String tokenSalt = passwordHasher.generateSalt();
        String hashedRefreshToken = passwordHasher.hash(rawRefreshToken, tokenSalt);

        RefreshToken refreshTokenEntity = new RefreshToken(
                null,
                user.getUserId(),
                hashedRefreshToken,
                tokenSalt,
                expiresAt,
                now
        );

        Integer refreshTokenId = refreshTokenRepository.addToken(refreshTokenEntity);

        return new AuthResponseDto(
                accessToken,
                refreshTokenId,
                rawRefreshToken,
                user.getRole().name()
        );
    }
}