package com.infp.place.client;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Component
public class NominatimClient {

    private final WebClient webClient;

    public NominatimClient(WebClient.Builder builder) {
        this.webClient = builder
                .baseUrl("http://nominatim:8080") // 도커 내부 주소
                .build();
    }

    public Mono<List<Map<String, Object>>> search(String query) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search")
                        .queryParam("format", "jsonv2")
                        .queryParam("limit", 6)
                        .queryParam("q", query)
                        .build())
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {}) // Java 런타임에서 제네릭 정보를 잃기에 "ParameterizedTypeReference" 사용하여 타입 정보 유지
                .onErrorReturn(List.of());
    }
}
