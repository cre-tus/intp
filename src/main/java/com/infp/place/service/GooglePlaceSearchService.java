package com.infp.place.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infp.place.dto.PlaceItem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class GooglePlaceSearchService {
    private static final Duration CACHE_TTL = Duration.ofDays(14);
    private static final int MAX_RESULTS = 5;

    private final WebClient webClient;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String apiKey;

    public GooglePlaceSearchService(
            WebClient.Builder webClientBuilder,
            StringRedisTemplate redisTemplate,
            @Value("${google.maps.server-api-key:${GOOGLE_PRIVATE_API:${GOOGLE_SERVER_API_KEY:${GOOGLE_CLOUD_API_KEY:}}}}") String apiKey
    ) {
        this.webClient = webClientBuilder.baseUrl("https://maps.googleapis.com").build();
        this.redisTemplate = redisTemplate;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public Mono<List<PlaceItem>> search(String query) {
        String normalized = normalize(query);
        if (normalized.length() < 2) return Mono.just(List.of());
        if (apiKey.isBlank()) {
            return Mono.error(new IllegalStateException("Google 吏??API ?ㅺ? ?ㅼ젙?섏? ?딆븯?듬땲??"));
        }

        String cacheKey = "place:google:text:v1:" + normalized;
        List<PlaceItem> cached = readCache(cacheKey);
        if (cached != null) return Mono.just(cached);

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/maps/api/place/textsearch/json")
                        .queryParam("query", normalized)
                        .queryParam("language", "ko")
                        .queryParam("region", "jp")
                        .queryParam("key", apiKey)
                        .build())
                .retrieve()
                .bodyToMono(new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {})
                .map(body -> {
                    List<PlaceItem> items = toPlaceItems(body, normalized);
                    writeCache(cacheKey, items);
                    return items;
                });
    }

    private List<PlaceItem> toPlaceItems(Map<String, Object> body, String sourceQuery) {
        Object status = body.get("status");
        if (status != null && !"OK".equals(status) && !"ZERO_RESULTS".equals(status)) {
            String message = stringValue(body.get("error_message"));
            throw new IllegalStateException("Google 장소 검색을 사용할 수 없습니다: " + status + (message.isBlank() ? "" : " - " + message));
        }

        Object resultsValue = body.get("results");
        if (!(resultsValue instanceof List<?> results)) return List.of();

        List<PlaceItem> items = new ArrayList<>();
        for (Object item : results) {
            if (items.size() >= MAX_RESULTS) break;
            if (!(item instanceof Map<?, ?> result)) continue;

            String placeId = stringValue(result.get("place_id"));
            String name = stringValue(result.get("name"));
            String address = stringValue(result.get("formatted_address"));
            double lat = coordinate(result, "lat");
            double lon = coordinate(result, "lng");
            if (placeId.isBlank() || name.isBlank() || !hasValidCoordinates(lat, lon)) continue;

            items.add(new PlaceItem(
                    "google:" + placeId,
                    name,
                    name,
                    name,
                    null,
                    null,
                    address,
                    lat,
                    lon,
                    importance(result.get("rating")),
                    sourceQuery
            ));
        }
        return items;
    }

    private List<PlaceItem> readCache(String cacheKey) {
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached == null || cached.isBlank()) return null;
            return objectMapper.readValue(cached, new TypeReference<>() {});
        } catch (Exception ignored) {
            return null;
        }
    }

    private void writeCache(String cacheKey, List<PlaceItem> items) {
        try {
            redisTemplate.opsForValue().set(cacheKey, objectMapper.writeValueAsString(items), CACHE_TTL);
        } catch (Exception ignored) {
            // Cache failures should not block place search.
        }
    }

    private static double coordinate(Map<?, ?> result, String key) {
        Object geometryValue = result.get("geometry");
        if (!(geometryValue instanceof Map<?, ?> geometry)) return Double.NaN;
        Object locationValue = geometry.get("location");
        if (!(locationValue instanceof Map<?, ?> location)) return Double.NaN;
        return doubleValue(location.get(key));
    }

    private static double importance(Object value) {
        double rating = doubleValue(value);
        return Double.isFinite(rating) ? rating : 0.0;
    }

    private static double doubleValue(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        try {
            return value == null ? Double.NaN : Double.parseDouble(String.valueOf(value));
        } catch (Exception ignored) {
            return Double.NaN;
        }
    }

    private static String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static boolean hasValidCoordinates(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
