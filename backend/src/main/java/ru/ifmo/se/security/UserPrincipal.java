package ru.ifmo.se.security;

import lombok.AllArgsConstructor;
import lombok.Getter;
import ru.ifmo.se.entity.Role;

import java.security.Principal;

@Getter
@AllArgsConstructor
public class UserPrincipal implements Principal {

    private Integer userId;
    private String login;
    private Role role;

    @Override
    public String getName() {
        return login;
    }
}
