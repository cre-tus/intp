package com.infp.user.dto;

public record UserLookupResponse(
        Long id,
        String email,
        String nickname
) {
}
