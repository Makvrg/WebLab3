package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;
import ru.ifmo.se.exceptions.NotUniqueIdException;

@Provider
@Log
public class NotUniqueIdExceptionMapper implements ExceptionMapper<NotUniqueIdException> {

    @Override
    public Response toResponse(NotUniqueIdException exception) {
        log.warning("Конфликт данных: " + exception.getMessage());

        ErrorDto error = new ErrorDto(
                new ErrorDto.ErrorDetail(
                        "CONFLICT",
                        exception.getMessage()
                )
        );

        return Response.status(Response.Status.CONFLICT)
                .type(MediaType.APPLICATION_JSON)
                .entity(error)
                .build();
    }
}
