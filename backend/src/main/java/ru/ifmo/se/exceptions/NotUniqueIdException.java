package ru.ifmo.se.exceptions;

public class NotUniqueIdException extends RuntimeException {
    public NotUniqueIdException(String message) {
        super(message);
    }
}
