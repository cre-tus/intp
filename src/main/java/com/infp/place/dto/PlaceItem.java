package com.infp.place.dto;

public record PlaceItem(
        String id,
        String title,
        String displayTitle,
        String titleKo,
        String titleEn,
        String titleJa,
        String subtitle,
        double lat,
        double lon,
        double importance,
        String sourceQuery
) {}
