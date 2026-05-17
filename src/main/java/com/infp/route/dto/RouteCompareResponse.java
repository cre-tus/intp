package com.infp.route.dto;

public record RouteCompareResponse(
        RouteOptimizationResponse manual,
        RouteOptimizationResponse optimized,
        double savedDistanceKm,
        int savedMinutes,
        double improvementPercent
) {
}
