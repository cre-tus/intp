package com.infp.follow.dto;

public record FollowStatusResponse(
        Long userId,
        boolean following,
        long followers,
        long followingCount
) {
}
