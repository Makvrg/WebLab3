package ru.ifmo.se.exceptions.mapper;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import lombok.extern.java.Log;
import ru.ifmo.se.dto.ErrorDto;
import ru.ifmo.se.exceptions.NotFoundException;

@Provider
@Log
public class NotFoundExceptionMapper implements ExceptionMapper<NotFoundException> {
    @Override
    public Response toResponse(NotFoundException exception) {
        log.warning("Не найдено: " + exception.getMessage());

        ErrorDto error = new ErrorDto(new ErrorDto.ErrorDetail("NOT_FOUND", exception.getMessage()));
        return Response.status(Response.Status.NOT_FOUND)
                .entity(error)
                .build();
    }
}