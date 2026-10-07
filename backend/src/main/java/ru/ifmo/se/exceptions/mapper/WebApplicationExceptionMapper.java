package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.NotSupportedException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;

@Provider
@Log
public class WebApplicationExceptionMapper implements ExceptionMapper<WebApplicationException> {

    @Override
    public Response toResponse(WebApplicationException exception) {
        if (exception instanceof NotSupportedException) {
            log.warning("Неподдерживаемый тип данных (не JSON): " + exception.getMessage());
            ErrorDto error = new ErrorDto(
                    new ErrorDto.ErrorDetail("BAD_REQUEST", "Request body must be JSON")
            );
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(error)
                    .build();
        }

        int status = exception.getResponse().getStatus();
        String code = Response.Status.fromStatusCode(status) != null
                ? Response.Status.fromStatusCode(status).name()
                : "CLIENT_ERROR";

        log.warning("HTTP ошибка (" + status + "): " + exception.getMessage());

        ErrorDto error = new ErrorDto(
                new ErrorDto.ErrorDetail(code, exception.getMessage())
        );

        return Response.status(status)
                .entity(error)
                .build();
    }
}