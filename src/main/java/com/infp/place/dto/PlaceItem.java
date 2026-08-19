package com.infp.place.dto;

import java.util.Locale;

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
        String sourceQuery,
        String category,
        String type,
        String provider
) {
    public PlaceItem {
        if (provider == null || provider.isBlank()) {
            provider = inferProvider(id);
        }
    }

    public PlaceItem(
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
            String sourceQuery,
            String category,
            String type
    ) {
        this(id, title, displayTitle, titleKo, titleEn, titleJa, subtitle, lat, lon, importance, sourceQuery, category, type, inferProvider(id));
    }

    public PlaceItem withProvider(String newProvider) {
        return new PlaceItem(id, title, displayTitle, titleKo, titleEn, titleJa, subtitle, lat, lon, importance, sourceQuery, category, type, newProvider);
    }

    public static String inferProvider(String id) {
        if (id == null) return "nominatim";
        String lower = id.toLowerCase(Locale.ROOT);
        if (lower.startsWith("custom:") || lower.startsWith("custom")) return "custom";
        if (lower.startsWith("redis:") || lower.startsWith("cache:")) return "redis";
        if (lower.startsWith("google:") || lower.startsWith("google")) return "google";
        if (lower.startsWith("photon:")) return "photon";
        if (lower.startsWith("place:") || lower.startsWith("nominatim:")) return "nominatim";
        return "nominatim";
    }
}
