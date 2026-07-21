package com.infp.auth.dto;

public record ProfileUpdateRequest(
        String statusMessage,
        String profileImageUrl
) {
}
