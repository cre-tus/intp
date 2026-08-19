package com.infp.admin;

import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.place.service.GooglePlaceSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.List;
import java.util.Map;
import java.time.Duration;

@RestController
@RequestMapping("/api/admin/ml-ingest")
public class AdminMlIngestController {
    private final AdminMlIngestService service;
    private final AdminMlIngestLearningService learningService;
    private final AdminMlIngestPlanService planService;
    private final GooglePlaceSearchService googlePlaceSearchService;

    public AdminMlIngestController(
            AdminMlIngestService service,
            AdminMlIngestLearningService learningService,
            AdminMlIngestPlanService planService,
            GooglePlaceSearchService googlePlaceSearchService
    ) {
        this.service = service;
        this.learningService = learningService;
        this.planService = planService;
        this.googlePlaceSearchService = googlePlaceSearchService;
    }

    @PostMapping(value = "/jobs", consumes = "multipart/form-data")
    public ResponseEntity<?> start(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestPart("files") List<MultipartFile> files,
            @RequestPart(value = "mode", required = false) String mode,
            @RequestPart(value = "model", required = false) String model,
            @RequestPart(value = "layout", required = false) String layout
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.accepted().body(service.start(files, mode, model, layout));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("로컬 ML 작업 서비스에 연결할 수 없습니다: " + exception.getMessage());
        }
    }

    @PostMapping(value = "/text-jobs", consumes = "application/json")
    public ResponseEntity<?> startText(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody Map<String, Object> payload
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.accepted().body(service.startText(String.valueOf(payload.getOrDefault("text", ""))));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("로컬 ML 텍스트 작업 서비스에 연결할 수 없습니다: " + exception.getMessage());
        }
    }

    @PostMapping(value = "/json-jobs", consumes = "application/json")
    public ResponseEntity<?> startJson(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody Map<String, Object> payload
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.accepted().body(service.startJson(payload));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("로컬 ML JSON 작업 서비스에 연결할 수 없습니다: " + exception.getMessage());
        }
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<?> status(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(service.status(jobId));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("ML 작업 상태를 조회할 수 없습니다: " + exception.getMessage());
        }
    }

    @GetMapping("/jobs")
    public ResponseEntity<?> jobs(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(service.jobs());
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("이전 ML 작업을 조회할 수 없습니다: " + exception.getMessage());
        }
    }

    @GetMapping("/place-search/google")
    public ResponseEntity<?> adminGooglePlaceSearch(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @org.springframework.web.bind.annotation.RequestParam String q,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "JP") String countryCode
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(googlePlaceSearchService.search(q, countryCode).block(Duration.ofSeconds(30)));
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("Google 장소 검색에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/jobs/{jobId}/approve")
    public ResponseEntity<?> approve(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(applyApprovedJob(service.approve(jobId), principal.userId()));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("학습 데이터 반영에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/jobs/{jobId}/reapply")
    public ResponseEntity<?> reapply(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(applyApprovedJob(service.reapply(jobId), principal.userId()));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("학습 시드 재반영에 실패했습니다: " + exception.getMessage());
        }
    }

    private java.util.Map<String, Object> applyApprovedJob(java.util.Map<String, Object> result, long userId) {
        result.put("localLearningApplied", learningService.learnApprovedPlaces(result));
        String travelPlanId = planService.saveApprovedBasicPlan(result, userId);
        if (travelPlanId.isBlank()) {
            throw new IllegalStateException("기본 템플릿 일정으로 저장할 데이터가 없습니다.");
        }
        result.put("travelPlanId", travelPlanId);
        return result;
    }

    @PostMapping("/jobs/{jobId}/retry-json")
    public ResponseEntity<?> retryJson(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.accepted().body(service.retryJson(jobId));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("JSON 구조화 재시도에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/jobs/{jobId}/review-coordinates")
    public ResponseEntity<?> updateReviewCoordinates(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId,
            @RequestBody Map<String, Object> payload
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(service.updateReviewCoordinates(jobId, payload));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("좌표 수정 저장에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/jobs/{jobId}/review-features")
    public ResponseEntity<?> updateReviewFeatures(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId,
            @RequestBody Map<String, Object> payload
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(service.updateReviewFeatures(jobId, payload));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("학습 피처 저장에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/jobs/{jobId}/review-delete")
    public ResponseEntity<?> deleteReviewItem(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId,
            @RequestBody Map<String, Object> payload
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(service.deleteReviewItem(jobId, payload));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("일정 삭제에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/jobs/{jobId}/review-content")
    public ResponseEntity<?> updateReviewContent(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId,
            @RequestBody Map<String, Object> payload
    ) {
        ResponseEntity<?> denied = requireAdmin(principal);
        if (denied != null) return denied;
        try {
            return ResponseEntity.ok(service.updateReviewContent(jobId, payload));
        } catch (WebClientResponseException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(exception.getResponseBodyAsString());
        } catch (Exception exception) {
            return ResponseEntity.status(502).body("여행 일정 수정 저장에 실패했습니다: " + exception.getMessage());
        }
    }

    private ResponseEntity<?> requireAdmin(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        if (!"ADMIN".equals(principal.role())) return ResponseEntity.status(403).build();
        return null;
    }
}
