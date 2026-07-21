package com.infp.follow.dto;

public record FollowStatsResponse(
        Long userId,
        long followers,
        long following
) {
}
