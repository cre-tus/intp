package com.infp.auth.dto;

public record EmailCheckResponse(
        String email,
        boolean available
) {
}
