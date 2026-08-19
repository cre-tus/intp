package com.infp.place.controller;

import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.payment.PaymentRequestRepository;
import com.infp.payment.PaymentStatus;
import com.infp.place.dto.PlaceItem;
import com.infp.place.dto.PlaceSelectionRequest;
import com.infp.place.service.GooglePlaceSearchService;
import com.infp.place.service.PlaceMemoryService;
import com.infp.place.service.PlaceAutocompleteService;
import com.infp.travel.TravelPlanService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/place")
public class PlaceController {
    private final PlaceAutocompleteService service;
    private final GooglePlaceSearchService googlePlaceSearchService;
    private final PlaceMemoryService placeMemoryService;
    private final TravelPlanService travelPlanService;
    private final PaymentRequestRepository paymentRequestRepository;
    private final String googleMapsApiKey;

    public PlaceController(
            PlaceAutocompleteService service,
            GooglePlaceSearchService googlePlaceSearchService,
            PlaceMemoryService placeMemoryService,
            TravelPlanService travelPlanService,
            PaymentRequestRepository paymentRequestRepository,
            @Value("${google.maps.browser-api-key:${GOOGLE_MAP_API:${GOOGLE_BROWSER_API_KEY:${GOOGLE_MAPS_API_KEY:}}}}") String googleMapsApiKey
    ) {
        this.service = service;
        this.googlePlaceSearchService = googlePlaceSearchService;
        this.placeMemoryService = placeMemoryService;
        this.travelPlanService = travelPlanService;
        this.paymentRequestRepository = paymentRequestRepository;
        this.googleMapsApiKey = googleMapsApiKey == null ? "" : googleMapsApiKey.trim();
    }

    @GetMapping("/autocomplete")
    public Mono<List<PlaceItem>> autocomplete(
            @RequestParam String q,
            @RequestParam(defaultValue = "KR") String countryCode,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon
    ) {
        return service.autocomplete(q, countryCode, lat, lon);
    }

    @GetMapping("/memory/custom")
    public List<PlaceItem> customMemory(
            @RequestParam String q,
            @RequestParam(defaultValue = "JP") String countryCode
    ) {
        return placeMemoryService.search(q, countryCode, 10).stream()
                .filter(place -> "custom".equalsIgnoreCase(place.provider()))
                .toList();
    }

    @PostMapping("/selection")
    public Map<String, Boolean> recordSelection(
            @RequestBody PlaceSelectionRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        long userId = requireUser(principal);
        if (request != null && "google".equalsIgnoreCase(request.provider())) {
            requirePaidGoogleAccess(request.planId(), userId);
        }
        placeMemoryService.recordSelection(request);
        if (request != null && request.place() != null) {
            service.rememberSelection(request.place(), request.query(), request.countryCode());
        }
        return Map.of("saved", true);
    }

    @GetMapping("/google/search")
    public Mono<List<PlaceItem>> googleSearch(
            @RequestParam String q,
            @RequestParam String planId,
            @RequestParam(defaultValue = "KR") String countryCode,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        long userId = requireUser(principal);
        requirePaidGoogleAccess(planId, userId);
        return googlePlaceSearchService.search(q, countryCode);
    }

    @GetMapping("/google/access")
    public Map<String, Object> googleAccess(
            @RequestParam String planId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        long userId = requireUser(principal);
        String tier = googleAccessTier(planId, userId);
        return Map.of(
                "tier", tier,
                "paid", "PAID".equals(tier)
        );
    }

    @GetMapping("/google/maps-key")
    public Map<String, String> googleMapsKey(
            @RequestParam String planId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        long userId = requireUser(principal);
        requirePaidGoogleAccess(planId, userId);
        if (googleMapsApiKey.isBlank()) throw new IllegalStateException("Google 지도 API 키가 설정되지 않았습니다.");
        return Map.of("apiKey", googleMapsApiKey);
    }

    private void requirePaidGoogleAccess(String planId, long userId) {
        if ("PAID".equals(googleAccessTier(planId, userId))) return;
        throw new IllegalArgumentException("유료 승인된 여행 계획에서만 Google 장소 검색을 사용할 수 있습니다.");
    }

    private String googleAccessTier(String planId, long userId) {
        String planTier = "FREE";
        try {
            planTier = travelPlanService.googlePlaceTier(planId, userId);
        } catch (IllegalArgumentException ignored) {
            // 결제 요청 기준으로도 권한을 복구한다.
        }

        if ("PAID".equals(planTier)
                || paymentRequestRepository.existsByPlanIdAndStatus(planId, PaymentStatus.APPROVED)) {
            travelPlanService.updateTier(planId, "PAID");
            return "PAID";
        }

        Long requesterId = userId;
        if (paymentRequestRepository.existsByPlanIdAndRequester_IdAndStatus(planId, requesterId, PaymentStatus.PENDING)) {
            travelPlanService.updateTier(planId, "PENDING_PAID");
            return "PENDING_PAID";
        }
        return "FREE";
    }

    private long requireUser(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("로그인이 필요합니다.");
        return principal.userId();
    }
}
