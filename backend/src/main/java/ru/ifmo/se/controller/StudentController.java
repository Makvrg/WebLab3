package ru.ifmo.se.controller;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import ru.ifmo.se.annotation.QUERY;
import ru.ifmo.se.dto.StudentDto;
import ru.ifmo.se.dto.StudentFilterDto;
import ru.ifmo.se.security.UserPrincipal;
import ru.ifmo.se.service.StudentService;

import java.util.List;

@Path("/students")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class StudentController {

    @Inject
    private StudentService studentService;

    private String resolveSource(String headerValue) {
        return (headerValue != null && !headerValue.isBlank())
                ? headerValue.trim()
                : "UI";
    }

    @GET
    @RolesAllowed({"USER", "ADMIN"})
    public Response getStudents(
            @QueryParam("isuId") Integer isuId,
            @QueryParam("fio") String fio,
            @QueryParam("stGroup") String stGroup,
            @QueryParam("dormitoryNumber") Short dormitoryNumber,
            @QueryParam("room") Short room,
            @QueryParam("dateOfPlacement") String dateOfPlacement,
            @QueryParam("isNotRussian") Boolean isNotRussian,
            @QueryParam("pageSize") Integer pageSize,
            @QueryParam("pageNumber") Integer pageNumber
    ) {
        StudentFilterDto filters = new StudentFilterDto(
                isuId, fio, stGroup, dormitoryNumber, room,
                dateOfPlacement, isNotRussian, pageSize, pageNumber
        );

        List<StudentDto> students = studentService.getStudents(filters);
        return Response.ok(students).build();
    }

    @QUERY
    @RolesAllowed({"USER", "ADMIN"})
    public Response queryStudents(StudentFilterDto queryData) {
        List<StudentDto> students = studentService.queryStudents(queryData);
        return Response.ok(students).build();
    }

    @GET
    @Path("/{studentId}")
    @RolesAllowed({"USER", "ADMIN"})
    public Response getStudent(@PathParam("studentId") Integer isuId) {
        StudentDto student = studentService.getStudent(isuId);
        return Response.ok(student).build();
    }

    @POST
    @RolesAllowed({"ADMIN"})
    public Response createStudent(
            StudentDto data,
            @Context SecurityContext securityContext,
            @HeaderParam("X-Action-Source") String actionSource
    ) {
        UserPrincipal actor = (UserPrincipal) securityContext.getUserPrincipal();
        StudentDto student = studentService.createStudent(
                data, actor, resolveSource(actionSource));
        return Response.status(Response.Status.CREATED).entity(student).build();
    }

    @PATCH
    @Path("/{studentId}")
    @RolesAllowed({"ADMIN"})
    public Response updateStudent(
            @PathParam("studentId") Integer isuId,
            StudentDto data,
            @Context SecurityContext securityContext,
            @HeaderParam("X-Action-Source") String actionSource
    ) {
        UserPrincipal actor = (UserPrincipal) securityContext.getUserPrincipal();
        StudentDto student = studentService.updateStudent(
                isuId, data, actor, resolveSource(actionSource));
        return Response.ok(student).build();
    }

    @DELETE
    @Path("/{studentId}")
    @RolesAllowed({"ADMIN"})
    public Response deleteStudent(
            @PathParam("studentId") Integer isuId,
            @Context SecurityContext securityContext,
            @HeaderParam("X-Action-Source") String actionSource
    ) {
        UserPrincipal actor = (UserPrincipal) securityContext.getUserPrincipal();
        studentService.deleteStudent(
                isuId, actor, resolveSource(actionSource));
        return Response.noContent().build();
    }
}
