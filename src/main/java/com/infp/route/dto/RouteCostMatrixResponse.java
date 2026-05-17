package com.infp.route.dto;

import java.util.List;

public record RouteCostMatrixResponse(
        List<RoutePoint> points,
        int[][] minutes,
        double[][] distanceKm,
        List<TransitStop> nearestStops,
        String costModel
) {
}
