package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;
import ru.ifmo.se.exceptions.ForbiddenException;

@Provider
@Log
public class ForbiddenExceptionMapper implements ExceptionMapper<ForbiddenException> {

    @Override
    public Response toResponse(ForbiddenException exception) {
        log.warning("Доступ запрещен (403): " + exception.getMessage());

        ErrorDto error = new ErrorDto(
                new ErrorDto.ErrorDetail(
                        "FORBIDDEN",
                        exception.getMessage()
                )
        );

        return Response.status(Response.Status.FORBIDDEN)
                .type(MediaType.APPLICATION_JSON)
                .entity(error)
                .build();
    }
}
