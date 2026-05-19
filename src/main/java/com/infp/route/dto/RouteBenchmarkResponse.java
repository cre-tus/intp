package com.infp.route.dto;

public record RouteBenchmarkResponse(
        RouteOptimizationResponse withoutRedis,
        RouteOptimizationResponse withRedis,
        boolean redisCacheHit,
        int cacheHitCount,
        int cacheMissCount,
        long estimatedWithoutRedisMillis,
        long estimatedWithRedisMillis,
        long savedMillis,
        double speedupPercent
) {
}
