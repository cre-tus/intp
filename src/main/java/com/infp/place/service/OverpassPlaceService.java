package com.infp.place.service;

import com.infp.place.client.OverpassClient;
import com.infp.place.dto.PlaceItem;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class OverpassPlaceService {
    private static final List<String> CATEGORY_KEYS = List.of(
            "tourism", "amenity", "shop", "leisure", "historic", "railway",
            "public_transport", "aeroway", "natural", "man_made", "office",
            "emergency", "waterway", "place", "building", "highway", "landuse");

    private final OverpassClient overpassClient;
    private final PlaceTranslationService translationService;

    public OverpassPlaceService(OverpassClient overpassClient, PlaceTranslationService translationService) {
        this.overpassClient = overpassClient;
        this.translationService = translationService;
    }

    public Mono<List<PlaceItem>> nearby(double lat, double lon, int radiusMeters) {
        validateCoordinates(lat, lon);
        int radius = Math.max(5, Math.min(50, radiusMeters));
        return overpassClient.nearby(lat, lon, radius)
                .map(elements -> mapElements(elements, lat, lon))
                .flatMap(translationService::localizeResults);
    }

    private List<PlaceItem> mapElements(List<Map<String, Object>> elements, double originLat, double originLon) {
        Map<String, PlaceItem> unique = new LinkedHashMap<>();
        for (Map<String, Object> element : elements) {
            Map<String, Object> tags = asMap(element.get("tags"));
            String name = firstNonBlank(tags.get("name:ko"), tags.get("name"), tags.get("name:ja"), tags.get("name:en"));
            if (name.isBlank()) continue;
            double lat = coordinate(element, "lat", "center");
            double lon = coordinate(element, "lon", "center");
            if (!validCoordinates(lat, lon)) continue;
            String osmType = string(element.get("type")).toLowerCase(Locale.ROOT);
            String osmId = string(element.get("id"));
            if (osmType.isBlank() || osmId.isBlank()) continue;

            String category = CATEGORY_KEYS.stream().filter(tags::containsKey).findFirst().orElse("place");
            String type = string(tags.get(category));
            if (type.isBlank()) type = "unknown";
            if (isThemePark(category, type, name, tags)) {
                category = "tourism";
                type = "theme_park";
            }
            String titleKo = string(tags.get("name:ko"));
            String titleEn = string(tags.get("name:en"));
            String titleJa = string(tags.get("name:ja"));
            String displayTitle = displayTitle(name, titleKo, titleEn, titleJa);
            String subtitle = address(tags);
            double distance = distanceMeters(originLat, originLon, lat, lon);
            PlaceItem item = new PlaceItem(
                    "place:" + osmType + "/" + osmId,
                    name, displayTitle, titleKo, titleEn, titleJa, subtitle,
                    roundCoordinate(lat), roundCoordinate(lon),
                    1.0 / (1.0 + distance / 1_000.0),
                    originLat + "," + originLon,
                    category, type, "overpass");
            unique.putIfAbsent(item.id(), item);
        }
        return unique.values().stream()
                .sorted(Comparator.comparingDouble(item -> distanceMeters(originLat, originLon, item.lat(), item.lon())))
                .toList();
    }

    private static double coordinate(Map<String, Object> element, String key, String centerKey) {
        Object direct = element.get(key);
        if (direct != null) return number(direct);
        return number(asMap(element.get(centerKey)).get(key));
    }

    private static String address(Map<String, Object> tags) {
        List<String> parts = new ArrayList<>();
        for (String key : List.of("addr:full", "addr:province", "addr:city", "addr:district", "addr:suburb", "addr:street", "addr:housenumber")) {
            String value = string(tags.get(key));
            if (!value.isBlank() && !parts.contains(value)) parts.add(value);
        }
        return String.join(", ", parts);
    }

    private static boolean isThemePark(String category, String type, String name, Map<String, Object> tags) {
        if ("tourism".equals(category) && "theme_park".equals(type)) return true;
        if ("leisure".equals(category) && "water_park".equals(type)) return true;
        String text = (name + " " + string(tags.get("name:ko")) + " " + string(tags.get("name:en"))
                + " " + string(tags.get("name:ja"))).toLowerCase(Locale.ROOT);
        return List.of(
                "disney", "디즈니", "ディズニー",
                "universal studios", "유니버설 스튜디오", "ユニバーサル・スタジオ",
                "harry potter", "해리포터", "ハリー・ポッター", "warner bros. studio tour",
                "theme park", "테마파크", "テーマパーク", "amusement park", "놀이공원"
        ).stream().anyMatch(text::contains);
    }

    private static String displayTitle(String name, String ko, String en, String ja) {
        String main = !ko.isBlank() ? ko : name;
        List<String> alternatives = new ArrayList<>();
        for (String value : List.of(name, en, ja)) {
            if (!value.isBlank() && !value.equalsIgnoreCase(main)
                    && alternatives.stream().noneMatch(value::equalsIgnoreCase)) alternatives.add(value);
        }
        return alternatives.isEmpty() ? main : main + " (" + String.join(", ", alternatives) + ")";
    }

    private static void validateCoordinates(double lat, double lon) {
        if (!validCoordinates(lat, lon)) throw new IllegalArgumentException("유효한 위도와 경도를 입력하세요.");
    }

    private static boolean validCoordinates(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private static double roundCoordinate(double value) {
        return Math.round(value * 1_000_000.0) / 1_000_000.0;
    }

    private static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6_371_000.0 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static double number(Object value) {
        try { return Double.parseDouble(string(value)); }
        catch (NumberFormatException ignored) { return Double.NaN; }
    }

    private static String firstNonBlank(Object... values) {
        for (Object value : values) {
            String text = string(value);
            if (!text.isBlank()) return text;
        }
        return "";
    }

    private static String string(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }
}
