package ru.ifmo.se.exceptions.mapper;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;

import java.util.stream.Collectors;

@Provider
@Log
public class ConstraintViolationExceptionMapper implements ExceptionMapper<ConstraintViolationException> {
    @Override
    public Response toResponse(ConstraintViolationException exception) {
        String messages = exception.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining(", "));

        log.warning("Ошибка валидации JAX-RS: " + messages);

        ErrorDto error = new ErrorDto(new ErrorDto.ErrorDetail("BAD_REQUEST", messages));
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(error)
                .build();
    }
}