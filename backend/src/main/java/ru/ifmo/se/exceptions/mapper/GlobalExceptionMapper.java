package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;

import java.util.logging.Level;

@Provider
@Log
public class GlobalExceptionMapper implements ExceptionMapper<Throwable> {

    @Override
    public Response toResponse(Throwable exception) {

        if (exception instanceof jakarta.json.bind.JsonbException
                || exception.getCause() instanceof jakarta.json.bind.JsonbException) {

            ErrorDto error = new ErrorDto(
                    new ErrorDto.ErrorDetail(
                            "BAD_REQUEST",
                            "Некорректный формат JSON"
                    )
            );

            return Response.status(Response.Status.BAD_REQUEST)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(error)
                    .build();
        }

        log.log(
                Level.SEVERE,
                "Внутренняя ошибка сервера при обработке запроса",
                exception
        );

        ErrorDto error = new ErrorDto(
                new ErrorDto.ErrorDetail(
                        "INTERNAL_SERVER_ERROR",
                        "The server cannot process the error"
                )
        );

        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON)
                .entity(error)
                .build();
    }
}
