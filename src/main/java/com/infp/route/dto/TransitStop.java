package com.infp.route.dto;

import java.util.List;

public record TransitStop(
        String stopId,
        String name,
        double lat,
        double lon,
        int distanceMeters,
        List<String> routes
) {
}
