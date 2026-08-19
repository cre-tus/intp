package com.infp.place.util;

import com.infp.place.dto.PlaceItem;

import java.util.List;
import java.util.Locale;

public final class CountryPlaceFilter {
    private static final List<Point> SOUTH_KOREA_MAINLAND = List.of(
            new Point(125.80, 38.70),
            new Point(128.40, 38.70),
            new Point(129.80, 37.00),
            new Point(129.55, 35.05),
            new Point(128.70, 34.65),
            new Point(127.45, 34.25),
            new Point(126.00, 34.45),
            new Point(125.75, 35.20),
            new Point(126.00, 36.10)
    );

    private CountryPlaceFilter() {
    }

    public static boolean isAllowed(PlaceItem item, String countryCode) {
        if (item == null || !"JP".equalsIgnoreCase(countryCode)) return item != null;
        if (hasKoreanAddressMarker(item.subtitle())) return false;
        return !isInSouthKorea(item.lat(), item.lon());
    }

    private static boolean hasKoreanAddressMarker(String subtitle) {
        if (subtitle == null || subtitle.isBlank()) return false;
        String value = subtitle.toLowerCase(Locale.ROOT);
        return value.contains("대한민국")
                || value.contains("republic of korea")
                || value.contains("south korea")
                || value.matches(".*(?:,|\\s)kr(?:$|,).*" );
    }

    private static boolean isInSouthKorea(double lat, double lon) {
        if (insideRectangle(lat, lon, 33.05, 33.65, 126.05, 126.98)) return true;
        if (insideRectangle(lat, lon, 37.40, 37.60, 130.75, 131.00)) return true;
        return insidePolygon(lat, lon, SOUTH_KOREA_MAINLAND);
    }

    private static boolean insideRectangle(
            double lat,
            double lon,
            double minLat,
            double maxLat,
            double minLon,
            double maxLon
    ) {
        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    }

    private static boolean insidePolygon(double lat, double lon, List<Point> polygon) {
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            Point a = polygon.get(i);
            Point b = polygon.get(j);
            boolean crosses = (a.lat > lat) != (b.lat > lat)
                    && lon < (b.lon - a.lon) * (lat - a.lat) / (b.lat - a.lat) + a.lon;
            if (crosses) inside = !inside;
        }
        return inside;
    }

    private record Point(double lon, double lat) {
    }
}
