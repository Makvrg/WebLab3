package ru.ifmo.se.security;

import jakarta.annotation.Priority;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import ru.ifmo.se.exceptions.ForbiddenException;
import ru.ifmo.se.exceptions.UnauthorizedException;

import java.lang.reflect.Method;
import java.security.Principal;
import java.util.Arrays;
import java.util.List;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class JwtAuthFilter implements ContainerRequestFilter {

    @Context
    private ResourceInfo resourceInfo;

    @Inject
    private JwtProvider jwtProvider;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if ("OPTIONS".equalsIgnoreCase(requestContext.getMethod())) {
            return;
        }

        Method method = resourceInfo.getResourceMethod();
        Class<?> resourceClass = resourceInfo.getResourceClass();

        if (method == null || resourceClass == null) {
            return;
        }

        if (method.isAnnotationPresent(PermitAll.class) ||
                (!method.isAnnotationPresent(RolesAllowed.class) && resourceClass.isAnnotationPresent(PermitAll.class))) {
            return;
        }

        RolesAllowed rolesAllowed = method.getAnnotation(RolesAllowed.class);
        if (rolesAllowed == null) {
            rolesAllowed = resourceClass.getAnnotation(RolesAllowed.class);
        }

        if (rolesAllowed == null) {
            return;
        }

        String authHeader = requestContext.getHeaderString(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new UnauthorizedException("Требуется авторизация (отсутствует Bearer токен)");
        }

        String token = authHeader.substring("Bearer ".length()).trim();
        JwtProvider.TokenPayload payload = jwtProvider.checkAccessToken(token);

        SecurityContext currentSecurityContext = requestContext.getSecurityContext();
        requestContext.setSecurityContext(new SecurityContext() {
            @Override
            public Principal getUserPrincipal() {
                return payload::getLogin;
            }

            @Override
            public boolean isUserInRole(String role) {
                return role != null && role.equals(payload.getRole());
            }

            @Override
            public boolean isSecure() {
                return currentSecurityContext != null && currentSecurityContext.isSecure();
            }

            @Override
            public String getAuthenticationScheme() {
                return "Bearer";
            }
        });

        List<String> allowedRoles = Arrays.asList(rolesAllowed.value());
        if (!allowedRoles.contains(payload.getRole())) {
            throw new ForbiddenException("Недостаточно прав для выполнения операции. Требуется роль: " + allowedRoles);
        }
    }
}