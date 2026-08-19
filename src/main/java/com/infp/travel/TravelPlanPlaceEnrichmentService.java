package com.infp.travel;

import com.infp.place.dto.PlaceItem;
import com.infp.place.dto.PlaceSelectionRequest;
import com.infp.place.service.GooglePlaceSearchService;
import com.infp.place.service.PlaceAutocompleteService;
import com.infp.place.service.PlaceMemoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Locale;

@Service
public class TravelPlanPlaceEnrichmentService {
    private static final Logger log = LoggerFactory.getLogger(TravelPlanPlaceEnrichmentService.class);

    private final PlaceMemoryService placeMemoryService;
    private final PlaceAutocompleteService placeAutocompleteService;
    private final GooglePlaceSearchService googlePlaceSearchService;

    public TravelPlanPlaceEnrichmentService(
            PlaceMemoryService placeMemoryService,
            PlaceAutocompleteService placeAutocompleteService,
            GooglePlaceSearchService googlePlaceSearchService
    ) {
        this.placeMemoryService = placeMemoryService;
        this.placeAutocompleteService = placeAutocompleteService;
        this.googlePlaceSearchService = googlePlaceSearchService;
    }

    public JsonNode enrichAndSyncPlanPlaces(TravelPlanEntity plan, JsonNode content) {
        if (plan == null || content == null) return content;
        String countryCode = extractCountryCode(content);

        JsonNode daysNode = content.get("days");
        if (daysNode == null || !daysNode.isArray()) return content;

        for (JsonNode dayNode : daysNode) {
            JsonNode activitiesNode = dayNode.get("activities");
            if (activitiesNode == null || !activitiesNode.isArray()) continue;

            for (JsonNode activityNode : activitiesNode) {
                if (!(activityNode instanceof ObjectNode activity)) continue;
                String time = text(activity, "time");
                if (time.startsWith("__")) continue;

                String location = text(activity, "location");
                String activityText = text(activity, "activity");
                String query = firstNonBlank(location, activityText);
                if (query.isBlank()) continue;

                Double lat = nullableDouble(activity, "lat");
                Double lon = nullableDouble(activity, "lon");
                String placeId = text(activity, "placeId");

                PlaceItem resolved = null;
                boolean needsGeocoding = lat == null || lon == null || !hasValidCoordinates(lat, lon);

                if (needsGeocoding) {
                    resolved = resolvePlaceByHierarchy(query, countryCode);
                    if (resolved != null && hasValidCoordinates(resolved.lat(), resolved.lon())) {
                        activity.put("lat", resolved.lat());
                        activity.put("lon", resolved.lon());
                        if (text(activity, "placeId").isBlank()) {
                            activity.put("placeId", resolved.id());
                        }
                        if (location.isBlank()) {
                            activity.put("location", resolved.title());
                        }
                        lat = resolved.lat();
                        lon = resolved.lon();
                        placeId = resolved.id();
                    }
                }

                // If activity has valid coordinates, sync to PlaceMemory / Search ML / Redis cache
                if (lat != null && lon != null && hasValidCoordinates(lat, lon)) {
                    PlaceItem placeItem = resolved != null ? resolved : new PlaceItem(
                            placeId.isBlank() ? ("place:" + lat + "," + lon) : placeId,
                            firstNonBlank(location, query),
                            firstNonBlank(location, query),
                            firstNonBlank(location, query),
                            null,
                            null,
                            activityText,
                            lat,
                            lon,
                            1.0,
                            query,
                            "place",
                            "unknown",
                            inferProvider(placeId)
                    );
                    try {
                        placeMemoryService.recordSelection(new PlaceSelectionRequest(
                                placeItem,
                                query,
                                placeItem.provider(),
                                plan.getExternalId(),
                                countryCode
                        ));
                    } catch (Exception e) {
                        log.warn("일정 장소 동기화 실패 (planId={}, query={}): {}", plan.getExternalId(), query, e.getMessage());
                    }
                }
            }
        }

        return content;
    }

    /**
     * Resolves missing coordinates in order: 1. DB -> 2. Local Nominatim -> 3. Google
     */
    private PlaceItem resolvePlaceByHierarchy(String query, String countryCode) {
        // 1. DB Search (place_memory)
        try {
            List<PlaceItem> dbResults = placeMemoryService.search(query, countryCode, 1);
            if (!dbResults.isEmpty()) {
                PlaceItem item = dbResults.get(0);
                if (hasValidCoordinates(item.lat(), item.lon())) {
                    return item;
                }
            }
        } catch (Exception e) {
            log.debug("DB 장소 검색 실패: {}", e.getMessage());
        }

        // 2. Local Nominatim Search
        try {
            List<PlaceItem> nominatimResults = placeAutocompleteService.autocomplete(query, countryCode, null, null).block();
            if (nominatimResults != null && !nominatimResults.isEmpty()) {
                PlaceItem item = nominatimResults.get(0);
                if (hasValidCoordinates(item.lat(), item.lon())) {
                    return item;
                }
            }
        } catch (Exception e) {
            log.debug("Nominatim 장소 검색 실패: {}", e.getMessage());
        }

        // 3. Google Places API Search
        try {
            List<PlaceItem> googleResults = googlePlaceSearchService.search(query, countryCode).block();
            if (googleResults != null && !googleResults.isEmpty()) {
                PlaceItem item = googleResults.get(0);
                if (hasValidCoordinates(item.lat(), item.lon())) {
                    return item;
                }
            }
        } catch (Exception e) {
            log.debug("Google 장소 검색 실패: {}", e.getMessage());
        }

        return null;
    }

    private static String extractCountryCode(JsonNode content) {
        JsonNode tripContext = content.get("tripContext");
        if (tripContext != null && tripContext.has("countryCode")) {
            String code = text(tripContext, "countryCode");
            if (!code.isBlank()) return code.toUpperCase(Locale.ROOT);
        }
        return "KR";
    }

    private static String inferProvider(String placeId) {
        if (placeId == null || placeId.isBlank()) return "local";
        String lower = placeId.toLowerCase(Locale.ROOT);
        if (lower.startsWith("google")) return "google";
        if (lower.startsWith("photon")) return "photon";
        if (lower.startsWith("custom")) return "custom";
        return "local";
    }

    private static boolean hasValidCoordinates(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText("").trim();
    }

    private static Double nullableDouble(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() || !value.isNumber() ? null : value.asDouble();
    }

    private static String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second != null ? second : "";
    }
}
