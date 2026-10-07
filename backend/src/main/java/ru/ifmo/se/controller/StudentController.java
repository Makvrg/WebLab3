package ru.ifmo.se.controller;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import ru.ifmo.se.annotation.QUERY;
import ru.ifmo.se.dto.StudentDto;
import ru.ifmo.se.dto.StudentFilterDto;
import ru.ifmo.se.service.StudentService;

import java.util.List;

@Path("/students")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class StudentController {

    @Inject
    private StudentService studentService;

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
        // JAX-RS автоматически десериализует тело JSON в объект StudentFilterDto
        List<StudentDto> students = studentService.queryStudents(queryData);
        return Response.ok(students).build();
    }

    @GET
    @Path("/{studentId}")
    @RolesAllowed({"USER", "ADMIN"})
    public Response getStudent(@PathParam("studentId") Integer studentId) {
        StudentDto student = studentService.getStudent(studentId);
        return Response.ok(student).build();
    }

    @POST
    @RolesAllowed({"ADMIN"})
    public Response createStudent(StudentDto data) {
        StudentDto student = studentService.createStudent(data);
        return Response.status(Response.Status.CREATED).entity(student).build();
    }

    @PATCH
    @Path("/{studentId}")
    @RolesAllowed({"ADMIN"})
    public Response updateStudent(@PathParam("studentId") Integer studentId, StudentDto data) {
        StudentDto student = studentService.updateStudent(studentId, data);
        return Response.ok(student).build();
    }

    @DELETE
    @Path("/{studentId}")
    @RolesAllowed({"ADMIN"})
    public Response deleteStudent(@PathParam("studentId") Integer studentId) {
        studentService.deleteStudent(studentId);
        return Response.noContent().build();
    }
}
