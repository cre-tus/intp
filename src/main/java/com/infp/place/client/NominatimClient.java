package com.infp.place.client;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Component
public class NominatimClient {

    private final WebClient koreaWebClient;
    private final WebClient japanWebClient;

    public NominatimClient(WebClient.Builder builder) {
        this.koreaWebClient = builder
                .baseUrl("http://nominatim:8080")
                .build();
        this.japanWebClient = builder.clone()
                .baseUrl("http://nominatim-jp:8080")
                .build();
    }

    public Mono<List<Map<String, Object>>> search(String query, String countryCode) {
        String normalizedCountry = normalizeCountry(countryCode);
        WebClient targetClient = "jp".equals(normalizedCountry) ? japanWebClient : koreaWebClient;

        return targetClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search")
                        .queryParam("format", "jsonv2")
                        .queryParam("limit", 6)
                        .queryParam("namedetails", 1)
                        .queryParam("accept-language", "jp".equals(normalizedCountry) ? "ja,ko,en" : "ko,en,ja")
                        .queryParam("countrycodes", normalizedCountry)
                        .queryParam("q", query)
                        .build())
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                .onErrorReturn(List.of());
    }

    private static String normalizeCountry(String countryCode) {
        if (countryCode == null) return "kr";
        return switch (countryCode.trim().toUpperCase()) {
            case "JP", "JPN", "JA" -> "jp";
            case "KR", "KOR", "KO" -> "kr";
            default -> "kr";
        };
    }
}
