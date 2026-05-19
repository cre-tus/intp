package com.infp.admin.dto;

import java.util.List;

public record ServerTestUserResult(
        int userIndex,
        long withoutRedisMillis,
        long withRedisMillis,
        boolean cacheHit,
        int cacheHitCount,
        int cacheMissCount,
        String withoutRedisComplexity,
        String withRedisComplexity,
        long withoutRedisOperationCount,
        long withRedisOperationCount,
        long savedMillis,
        double speedupPercent,
        List<ServerTestPoint> points,
        List<ServerTestPoint> optimizedRoute,
        String error
) {
}
