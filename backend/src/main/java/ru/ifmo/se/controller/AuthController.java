package ru.ifmo.se.controller;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
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
@NoArgsConstructor(force = true, access = AccessLevel.PROTECTED)
public class AuthController {

    private final AuthService authService;

    @Inject
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @POST
    @Path("/register")
    public Response register(@Valid UserRegisterDto registerDto) {
        authService.register(registerDto);
        return Response.status(Response.Status.CREATED).build();
    }

    @POST
    @Path("/login")
    public Response login(@Valid UserLoginDto loginDto) {
        AuthResponseDto authResponse = authService.login(loginDto);
        return Response.ok(authResponse).build();
    }

    @POST
    @Path("/refresh")
    public Response refresh(@Valid TokenRefreshRequestDto refreshDto) {
        AuthResponseDto authResponse = authService.refresh(refreshDto);
        return Response.ok(authResponse).build();
    }

    @POST
    @Path("/logout")
    public Response logout(@Valid LogoutRequestDto logoutDto) {
        authService.logout(logoutDto);
        return Response.noContent().build();
    }
}
