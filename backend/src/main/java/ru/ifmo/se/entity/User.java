package ru.ifmo.se.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class User {

    private String login;
    private String email;
    private Role role;
    private String hashedPassword;
    private String salt;

    @Override
    public String toString() {
        return "User{" +
                "login='" + login + '\'' +
                ", role=" + role +
                '}';
    }
}
