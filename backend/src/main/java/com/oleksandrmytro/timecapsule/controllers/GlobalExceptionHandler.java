package com.oleksandrmytro.timecapsule.controllers;

import com.oleksandrmytro.timecapsule.responses.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;

import java.util.UUID;
import java.util.stream.Collectors;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, WebRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return build(HttpStatus.BAD_REQUEST, "validation_error", message, request, ex);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, "bad_request", ex.getMessage(), request, ex);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex, WebRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        return build(status, "error", ex.getMessage(), request, ex);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, WebRequest request) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error", "Unexpected error", request, ex);
    }

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String code, String message, WebRequest request, Exception ex) {
        String path = (request instanceof ServletWebRequest swr) ? swr.getRequest().getRequestURI() : null;
        String traceId = UUID.randomUUID().toString();
        log.error("API error code={} path={} traceId={} msg={}", code, path, traceId, ex.getMessage(), ex);
        return ResponseEntity.status(status).body(new ErrorResponse(code, message, path, traceId));
    }
}

