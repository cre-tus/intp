package com.infp.route.dto;

public record RoutePoint(
        String id,
        String name,
        double lat,
        double lon,
        Integer originalIndex,
        String routeRole
) {
}
