package com.infp.admin.dto;

public record ServerTestUserResult(
        int userIndex,
        long withoutRedisMillis,
        long withRedisMillis,
        boolean cacheHit,
        long savedMillis,
        double speedupPercent,
        String error
) {
}
