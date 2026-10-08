package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;
import ru.ifmo.se.exceptions.ValidationException;

@Provider
@Log
public class ValidationExceptionMapper implements ExceptionMapper<ValidationException> {

    @Override
    public Response toResponse(ValidationException exception) {
        log.warning("Отклонено (Validation Error): " + exception.getMessage());

        ErrorDto error = new ErrorDto(
                new ErrorDto.ErrorDetail(
                        "VALIDATION_ERROR",
                        exception.getMessage()
                )
        );

        return Response.status(422)
                .type(MediaType.APPLICATION_JSON)
                .entity(error)
                .build();
    }
}
