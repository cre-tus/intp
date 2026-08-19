package com.infp.admin;

import com.infp.place.dto.PlaceItem;
import com.infp.place.dto.PlaceSelectionRequest;
import com.infp.place.service.PlaceMemoryService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class AdminMlIngestLearningService {
    private final PlaceMemoryService placeMemoryService;

    public AdminMlIngestLearningService(PlaceMemoryService placeMemoryService) {
        this.placeMemoryService = placeMemoryService;
    }

    public int learnApprovedPlaces(Map<String, Object> job) {
        if (!"APPROVED".equals(text(job.get("status")))) return 0;
        Map<String, Object> review = map(job.get("review"));
        Map<String, Object> seed = map(review.get("seed_preview"));
        List<?> places = seed.get("places") instanceof List<?> value ? value : List.of();
        int learned = 0;
        for (Object value : places) {
            Map<String, Object> place = map(value);
            String coordinateSource = text(place.get("coordinate_source"));
            Double lat = number(place.get("lat"));
            Double lon = number(place.get("lon"));
            String sourcePlaceId = text(place.get("source_place_id"));
            String name = text(place.get("name"));
            if (!"nominatim".equalsIgnoreCase(coordinateSource)
                    && !"google".equalsIgnoreCase(coordinateSource)) continue;
            if (lat == null || lon == null || sourcePlaceId.isBlank() || name.isBlank()) continue;

            String displayName = text(place.get("display_name"));
            String sourceQuery = text(place.get("source_query"));
            String lookupQuery = text(place.get("lookup_query"));
            String aliases = joinAliases(name, sourceQuery, lookupQuery);
            PlaceItem item = new PlaceItem(
                    ("google".equalsIgnoreCase(coordinateSource) ? "google:" : "place:") + sourcePlaceId,
                    name,
                    displayName.isBlank() ? name : displayName,
                    name,
                    null,
                    null,
                    aliases + (displayName.isBlank() ? "" : " " + displayName),
                    lat,
                    lon,
                    0.0,
                    aliases,
                    "nominatim".equalsIgnoreCase(coordinateSource) ? text(place.get("nominatim_category")) : "google",
                    "nominatim".equalsIgnoreCase(coordinateSource) ? text(place.get("nominatim_type")) : "unknown"
            );
            placeMemoryService.recordSelection(new PlaceSelectionRequest(
                    item,
                    aliases,
                    coordinateSource.toLowerCase(),
                    null,
                    "JP"
            ));
            learned++;
        }
        return learned;
    }

    private String joinAliases(String... values) {
        java.util.LinkedHashSet<String> aliases = new java.util.LinkedHashSet<>();
        for (String value : values) {
            String alias = text(value);
            if (!alias.isBlank()) aliases.add(alias);
        }
        return String.join(" | ", aliases);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Double number(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        try {
            return value == null ? null : Double.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
