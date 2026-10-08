package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;
import ru.ifmo.se.exceptions.UnauthorizedException;

@Provider
@Log
public class UnauthorizedExceptionMapper implements ExceptionMapper<UnauthorizedException> {

    @Override
    public Response toResponse(UnauthorizedException exception) {
        log.warning("Ошибка авторизации (401): " + exception.getMessage());

        ErrorDto error = new ErrorDto(
                new ErrorDto.ErrorDetail(
                        "UNAUTHORIZED",
                        exception.getMessage()
                )
        );

        return Response.status(Response.Status.UNAUTHORIZED)
                .type(MediaType.APPLICATION_JSON)
                .entity(error)
                .build();
    }
}
