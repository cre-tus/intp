package com.infp.route.dto;

import java.util.List;

public record TransitStopsResponse(
        double lat,
        double lon,
        int radiusMeters,
        List<TransitStop> stops
) {
}
