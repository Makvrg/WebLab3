package ru.ifmo.se.controller;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import ru.ifmo.se.dto.AuthResponseDto;
import ru.ifmo.se.dto.LogoutRequestDto;
import ru.ifmo.se.dto.TokenRefreshRequestDto;
import ru.ifmo.se.dto.UserLoginDto;
import ru.ifmo.se.dto.UserRegisterDto;
import ru.ifmo.se.service.AuthService;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@PermitAll
public class AuthController {

    @Inject
    private AuthService authService;

    @POST
    @Path("/register")
    public Response register(UserRegisterDto registerDto) {
        authService.register(registerDto);
        return Response.status(Response.Status.CREATED).build();
    }

    @POST
    @Path("/login")
    public Response login(UserLoginDto loginDto) {
        AuthResponseDto authResponse = authService.login(loginDto);
        return Response.ok(authResponse).build();
    }

    @POST
    @Path("/refresh")
    public Response refresh(TokenRefreshRequestDto refreshDto) {
        AuthResponseDto authResponse = authService.refresh(refreshDto);
        return Response.ok(authResponse).build();
    }

    @POST
    @Path("/logout")
    public Response logout(LogoutRequestDto logoutDto) {
        authService.logout(logoutDto);
        return Response.noContent().build();
    }
}