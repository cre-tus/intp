package com.infp.route.dto;

import java.util.List;

public record RouteOptimizationResponse(
        List<RoutePoint> order,
        List<RouteLeg> legs,
        int[][] costMatrixMinutes,
        double[][] costMatrixDistanceKm,
        List<TransitStop> nearestStops,
        double totalDistanceKm,
        int totalMinutes,
        long calculationMillis,
        String costModel
) {
}
