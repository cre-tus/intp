package com.infp.place.dto;

public record PlaceSelectionRequest(
        PlaceItem place,
        String query,
        String provider,
        String planId,
        String countryCode
) {
}
