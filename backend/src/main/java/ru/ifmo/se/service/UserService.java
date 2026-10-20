package ru.ifmo.se.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import ru.ifmo.se.dto.UserProfileDto;
import ru.ifmo.se.entity.Role;
import ru.ifmo.se.entity.User;
import ru.ifmo.se.exceptions.NotFoundException;
import ru.ifmo.se.exceptions.UnauthorizedException;
import ru.ifmo.se.exceptions.ValidationException;
import ru.ifmo.se.repository.UserRepository;

@ApplicationScoped
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class UserService {

    private final UserRepository repo;

    @Inject
    public UserService(UserRepository repo) {
        this.repo = repo;
    }

    private UserProfileDto toDto(User user) {
        return new UserProfileDto(
                user.getLogin(),
                user.getEmail(),
                user.getRole()
        );
    }

    @Transactional
    public UserProfileDto getAccessibleUser(Integer requesterUserId,
                                            Integer contextUserId,
                                            Role contextRole) {
        if (requesterUserId == null) {
            throw new ValidationException("Не передан id запрашиваемого юзера");
        }
        if (contextRole != Role.ADMIN && !requesterUserId.equals(contextUserId)) {
            throw new UnauthorizedException("Можно смотреть лишь свой профиль");
        }
        User user = repo.getUserById(requesterUserId)
                .orElseThrow(() -> new NotFoundException(
                        "Юзер с id " + requesterUserId + " не найден."
                ));
        return toDto(user);
    }
}
