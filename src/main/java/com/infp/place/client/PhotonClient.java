package com.infp.place.client;

import com.infp.place.dto.PlaceItem;
import com.infp.place.util.Geo;
import com.infp.place.util.KoreanPlaceNameResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class PhotonClient {

    private final WebClient webClient;
    private final boolean enabled;

    public PhotonClient(
            WebClient.Builder builder,
            @Value("${place.photon.base-url:http://photon:2322}") String baseUrl,
            @Value("${place.photon.enabled:false}") boolean enabled
    ) {
        this.webClient = builder.clone().baseUrl(baseUrl).build();
        this.enabled = enabled;
    }

    public Mono<List<PlaceItem>> search(String query, String countryCode, String userQuery) {
        return search(query, countryCode, userQuery, null, null);
    }

    public Mono<List<PlaceItem>> search(String query, String countryCode, String userQuery, Double lat, Double lon) {
        if (!enabled) return Mono.just(List.of());

        return webClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/api")
                            .queryParam("q", query)
                            .queryParam("limit", 20)
                            .queryParam("countrycode", countryCode);
                    if (lat != null && lon != null && Double.isFinite(lat) && Double.isFinite(lon)) {
                        uriBuilder.queryParam("lat", lat).queryParam("lon", lon);
                    }
                    return uriBuilder.build();
                })
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .timeout(Duration.ofSeconds(2))
                .map(body -> toPlaceItems(body, userQuery))
                .onErrorReturn(List.of());
    }

    private List<PlaceItem> toPlaceItems(Map<String, Object> body, String query) {
        List<PlaceItem> result = new ArrayList<>();
        for (Object rawFeature : asList(body.get("features"))) {
            Map<String, Object> feature = asMap(rawFeature);
            Map<String, Object> properties = asMap(feature.get("properties"));
            List<Object> coordinates = asList(asMap(feature.get("geometry")).get("coordinates"));
            if (coordinates.size() < 2) continue;

            String osmId = text(properties.get("osm_id"));
            String osmType = text(properties.get("osm_type"));
            String name = text(properties.get("name"));
            if (osmId.isBlank() || name.isBlank()) continue;
            if (!matchesKnownExactQuery(query, name, properties)) continue;

            String titleKo = text(properties.get("name:ko"));
            String titleEn = text(properties.get("name:en"));
            String titleJa = text(properties.get("name:ja"));
            if (titleJa.isBlank() && containsJapanese(name)) titleJa = name;
            if (isGenericLanguageLabel(titleKo)) titleKo = "";
            titleKo = KoreanPlaceNameResolver.resolveTitle(titleKo, query, name, titleEn, titleJa, name);
            String title = name;
            String displayTitle = bilingualTitle(titleKo, name, titleEn, titleJa);
            String subtitle = joinAddress(properties);

            result.add(new PlaceItem(
                    "photon:" + osmType + ":" + osmId,
                    title,
                    displayTitle,
                    titleKo,
                    titleEn,
                    titleJa,
                    subtitle,
                    Geo.normalize(number(coordinates.get(1))),
                    Geo.normalize(number(coordinates.get(0))),
                    0.45,
                    query,
                    "photon",
                    text(properties.get("type")),
                    "photon"
            ));
        }
        return result;
    }

    private String bilingualTitle(String titleKo, String title, String titleEn, String titleJa) {
        String main = titleKo.isBlank() ? title : titleKo;
        List<String> originals = new ArrayList<>();
        for (String candidate : List.of(title, titleJa, titleEn)) {
            if (candidate == null || candidate.isBlank() || candidate.equalsIgnoreCase(main)) continue;
            if (originals.stream().noneMatch(candidate::equalsIgnoreCase)) originals.add(candidate);
        }
        return originals.isEmpty() ? main : main + " (" + String.join(", ", originals) + ")";
    }

    private String joinAddress(Map<String, Object> properties) {
        List<String> parts = new ArrayList<>();
        for (String key : List.of("district", "city", "state", "country")) {
            String value = text(properties.get(key));
            if (!value.isBlank() && !parts.contains(value)) parts.add(value);
        }
        return String.join(", ", parts);
    }

    private static double number(Object value) {
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static boolean containsJapanese(String value) {
        return value != null && value.codePoints().anyMatch(codePoint ->
                (codePoint >= 0x3040 && codePoint <= 0x30ff)
                        || (codePoint >= 0x4e00 && codePoint <= 0x9faf));
    }

    private static boolean isGenericLanguageLabel(String value) {
        String normalized = compact(value);
        return java.util.Set.of("한국어", "일본어", "영어", "korean", "japanese", "english").contains(normalized);
    }

    private static boolean matchesKnownExactQuery(String query, String name, Map<String, Object> properties) {
        String compactQuery = compact(query);
        if (!compactQuery.contains("크라운힐스호텔우에노")
                && !compactQuery.contains("호텔크라운힐스우에노")
                && !compactQuery.contains("crownhillsueno")
                && !compactQuery.contains("ホテルクラウンヒルズ上野")) {
            return true;
        }
        String candidate = compact(name) + compact(text(properties.get("name:en"))) + compact(text(properties.get("name:ja")));
        return candidate.contains("ホテルクラウンヒルズ上野プレミア")
                || candidate.contains("hotelcrownhillsuenopremier");
    }

    private static String compact(String value) {
        return value == null ? "" : value.toLowerCase(java.util.Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> asList(Object value) {
        return value instanceof List<?> list ? (List<Object>) list : List.of();
    }
}
