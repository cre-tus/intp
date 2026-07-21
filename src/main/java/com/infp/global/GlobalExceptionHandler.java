package com.infp.global;

import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataAccessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(exception.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleServiceUnavailable(IllegalStateException exception) {
        return ResponseEntity.status(503).body(exception.getMessage());
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<String> handleDataAccess(DataAccessException exception) {
        log.error("Database request error", exception);
        String detail = exception.getMostSpecificCause() == null
                ? exception.getMessage()
                : exception.getMostSpecificCause().getMessage();
        return ResponseEntity.internalServerError().body("데이터베이스 저장소 오류: " + detail);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<String> handleNoResource(NoResourceFoundException exception) {
        return ResponseEntity.status(404).body("요청한 API를 찾을 수 없습니다: " + exception.getResourcePath());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleUnexpected(Exception exception) {
        log.error("Unexpected request error", exception);
        String detail = rootCauseMessage(exception);
        return ResponseEntity.internalServerError()
                .body("요청 처리 중 오류가 발생했습니다: " + detail);
    }

    private String rootCauseMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current.getMessage() == null || current.getMessage().isBlank()
                ? throwable.getClass().getSimpleName()
                : current.getMessage();
    }
}
