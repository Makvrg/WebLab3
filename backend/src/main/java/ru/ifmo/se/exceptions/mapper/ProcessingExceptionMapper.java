package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;

@Provider
@Log
public class ProcessingExceptionMapper implements ExceptionMapper<ProcessingException> {
    @Override
    public Response toResponse(ProcessingException exception) {
        log.warning("Ошибка чтения JSON или неверный формат типов данных: " + exception.getMessage());

        ErrorDto error = new ErrorDto(
                new ErrorDto.ErrorDetail("BAD_REQUEST", "Некорректный формат JSON или типов данных в теле запроса")
        );
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(error)
                .build();
    }
}