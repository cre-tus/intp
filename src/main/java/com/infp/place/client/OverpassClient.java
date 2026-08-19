package com.infp.place.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class OverpassClient {
    private final WebClient webClient;

    public OverpassClient(
            WebClient.Builder builder,
            @Value("${overpass.base-url:https://overpass-api.de/api}") String baseUrl) {
        this.webClient = builder.clone().baseUrl(baseUrl).build();
    }

    public Mono<List<Map<String, Object>>> nearby(double lat, double lon, int radiusMeters) {
        int radius = Math.max(5, Math.min(50, radiusMeters));
        String query = "[out:json][timeout:25];"
                + "("
                + "nwr(around:" + radius + "," + lat + "," + lon + ")[\"name\"][\"amenity\"~\"^(cafe|restaurant|fast_food|food_court|bar|pub)$\"];"
                + "nwr(around:" + radius + "," + lat + "," + lon + ")[\"name\"][\"shop\"];"
                + "nwr(around:" + radius + "," + lat + "," + lon + ")[\"name\"][\"tourism\"~\"^(theme_park|attraction)$\"];"
                + "nwr(around:" + radius + "," + lat + "," + lon + ")[\"name\"][\"leisure\"~\"^(water_park|amusement_arcade)$\"];"
                + ");"
                + "out center tags qt;";

        return webClient.post()
                .uri("/interpreter")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.USER_AGENT, "infp-place-dataset-admin/1.0")
                .body(BodyInserters.fromFormData("data", query))
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .map(payload -> {
                    Object elements = payload.get("elements");
                    if (!(elements instanceof List<?> list)) return List.<Map<String, Object>>of();
                    List<Map<String, Object>> result = new ArrayList<>();
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> map) result.add((Map<String, Object>) map);
                    }
                    return result;
                })
                .timeout(Duration.ofSeconds(30));
    }
}
