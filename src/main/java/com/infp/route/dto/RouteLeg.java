package com.infp.route.dto;

public record RouteLeg(
        RoutePoint from,
        RoutePoint to,
        double distanceKm,
        int estimatedMinutes,
        TransitStop fromStop,
        TransitStop toStop
) {
}
