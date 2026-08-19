package com.infp.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.List;

@Service
public class AdminMlIngestService {
    private static final ParameterizedTypeReference<Map<String, Object>> JSON_MAP = new ParameterizedTypeReference<>() {};
    private static final int MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
    private final WebClient client;

    public AdminMlIngestService(
            WebClient.Builder builder,
            @Value("${ml.ingest.base-url:http://127.0.0.1:8092}") String baseUrl
    ) {
        this.client = builder.clone()
                .baseUrl(baseUrl)
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(MAX_RESPONSE_BYTES))
                .build();
    }

    public Map<String, Object> start(List<MultipartFile> files, String mode, String model, String layout) throws IOException {
        if (files == null || files.isEmpty() || files.stream().allMatch(MultipartFile::isEmpty)) {
            throw new IllegalArgumentException("이미지 파일이 비어 있습니다.");
        }
        if (files.size() > 10) throw new IllegalArgumentException("이미지는 최대 10장까지 업로드할 수 있습니다.");
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;
            body.part("files", new NamedByteArrayResource(file.getBytes(), file.getOriginalFilename()))
                    .contentType(MediaType.parseMediaType(file.getContentType() == null ? "application/octet-stream" : file.getContentType()));
        }
        body.part("mode", "separate".equalsIgnoreCase(mode) ? "separate" : "combined");
        body.part("model", "qwen");
        body.part("layout", layout == null || layout.isBlank() ? "auto" : layout.trim().toLowerCase());
        return client.post()
                .uri("/jobs")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body.build()))
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> startText(String text) {
        String normalized = text == null ? "" : text.trim();
        if (normalized.length() < 20) throw new IllegalArgumentException("여행 일정 텍스트를 20자 이상 입력하세요.");
        if (normalized.length() > 100_000) throw new IllegalArgumentException("텍스트는 최대 100,000자까지 입력할 수 있습니다.");
        return client.post()
                .uri("/text-jobs")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("text", normalized))
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> startJson(Map<String, Object> itinerary) {
        if (itinerary == null || itinerary.isEmpty()) {
            throw new IllegalArgumentException("여행 일정 JSON을 입력하세요.");
        }
        return client.post()
                .uri("/json-jobs")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(itinerary)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> status(String jobId) {
        return client.get()
                .uri("/jobs/{jobId}", jobId)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(10));
    }

    public Map<String, Object> jobs() {
        return client.get()
                .uri("/jobs")
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(10));
    }

    public Map<String, Object> approve(String jobId) {
        return client.post()
                .uri("/jobs/{jobId}/approve", jobId)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> reapply(String jobId) {
        return client.post()
                .uri("/jobs/{jobId}/reapply", jobId)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> retryJson(String jobId) {
        return client.post()
                .uri("/jobs/{jobId}/retry-json", jobId)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> updateReviewCoordinates(String jobId, Map<String, Object> payload) {
        return client.post()
                .uri("/jobs/{jobId}/review-coordinates", jobId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> updateReviewFeatures(String jobId, Map<String, Object> payload) {
        return client.post()
                .uri("/jobs/{jobId}/review-features", jobId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> updateReviewContent(String jobId, Map<String, Object> payload) {
        return client.post()
                .uri("/jobs/{jobId}/review-content", jobId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JSON_MAP)
                .block(Duration.ofSeconds(30));
    }

    public Map<String, Object> deleteReviewItem(String jobId, Map<String, Object> payload) {
        return client.post().uri("/jobs/{jobId}/review-delete", jobId)
                .contentType(MediaType.APPLICATION_JSON).bodyValue(payload).retrieve()
                .bodyToMono(JSON_MAP).block(Duration.ofSeconds(30));
    }

    public Map<String, Object> syncSeedCoordinates(String name, double lat, double lon, String provider) {
        if (name == null || name.isBlank()) return Map.of("updated", 0);
        try {
            return client.post()
                    .uri("/sync-seed-coordinates")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "name", name.trim(),
                            "lat", lat,
                            "lon", lon,
                            "provider", provider == null ? "nominatim" : provider.trim()
                    ))
                    .retrieve()
                    .bodyToMono(JSON_MAP)
                    .block(Duration.ofSeconds(5));
        } catch (Exception exc) {
            return Map.of("updated", 0);
        }
    }

    private static final class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        private NamedByteArrayResource(byte[] bytes, String filename) {
            super(bytes);
            this.filename = filename == null ? "trip-image.png" : filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
