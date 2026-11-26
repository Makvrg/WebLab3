package ru.ifmo.se.controller;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import ru.ifmo.se.dto.AuditFilterDto;
import ru.ifmo.se.dto.AuditPageResponseDto;
import ru.ifmo.se.service.AuditService;

@Path("/audit")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN"})
public class AuditController {

    @Inject
    private AuditService auditService;

    @GET
    public Response getAuditLogs(
            @QueryParam("page") Integer page,
            @QueryParam("pageSize") Integer pageSize,
            @QueryParam("action") String action,
            @QueryParam("source") String source,
            @QueryParam("isuId") Integer isuId,
            @QueryParam("actorLogin") String actorLogin
    ) {
        AuditFilterDto filter = new AuditFilterDto(
                page,
                pageSize,
                action,
                source,
                isuId,
                actorLogin
        );
        AuditPageResponseDto response = auditService.getAuditLogs(filter);
        return Response.ok(response).build();
    }
}
