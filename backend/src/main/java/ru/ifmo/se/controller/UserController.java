package ru.ifmo.se.controller;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import ru.ifmo.se.dto.UserProfileDto;
import ru.ifmo.se.security.UserPrincipal;
import ru.ifmo.se.service.UserService;

@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserController {

    @Inject
    private UserService userService;
    @Context
    private SecurityContext securityContext;

    @GET
    @Path("/{userId}")
    @RolesAllowed({"USER", "ADMIN"})
    public Response getStudent(@PathParam("userId") Integer userId) {

        UserProfileDto user = userService.getAccessibleUser(
                userId,
                ((UserPrincipal) securityContext.getUserPrincipal()).getUserId(),
                ((UserPrincipal) securityContext.getUserPrincipal()).getRole()
        );
        return Response.ok(user).build();
    }
}
