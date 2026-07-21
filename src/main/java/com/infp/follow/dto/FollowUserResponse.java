package com.infp.follow.dto;

public record FollowUserResponse(
        long userId,
        String nickname,
        String handle,
        String avatar,
        boolean following
) {
}
