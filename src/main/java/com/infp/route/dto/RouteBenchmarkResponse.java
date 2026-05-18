package com.infp.route.dto;

public record RouteBenchmarkResponse(
        RouteOptimizationResponse withoutRedis,
        RouteOptimizationResponse withRedis,
        boolean redisCacheHit,
        long savedMillis,
        double speedupPercent
) {
}
