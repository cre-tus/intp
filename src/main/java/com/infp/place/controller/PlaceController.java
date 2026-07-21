package com.infp.place.controller;

import com.infp.auth.jwt.JwtAuthFilter;
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
    private final String googleMapsApiKey;

    public PlaceController(
            PlaceAutocompleteService service,
            GooglePlaceSearchService googlePlaceSearchService,
            PlaceMemoryService placeMemoryService,
            TravelPlanService travelPlanService,
            @Value("${google.maps.browser-api-key:${GOOGLE_MAP_API:${GOOGLE_BROWSER_API_KEY:${GOOGLE_MAPS_API_KEY:}}}}") String googleMapsApiKey
    ) {
        this.service = service;
        this.googlePlaceSearchService = googlePlaceSearchService;
        this.placeMemoryService = placeMemoryService;
        this.travelPlanService = travelPlanService;
        this.googleMapsApiKey = googleMapsApiKey == null ? "" : googleMapsApiKey.trim();
    }

    @GetMapping("/autocomplete")
    public Mono<List<PlaceItem>> autocomplete(
            @RequestParam String q,
            @RequestParam(defaultValue = "KR") String countryCode
    ) {
        return service.autocomplete(q, countryCode);
    }

    @PostMapping("/selection")
    public Map<String, Boolean> recordSelection(@RequestBody PlaceSelectionRequest request) {
        placeMemoryService.recordSelection(request);
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
        travelPlanService.requirePaidOwnerPlan(planId, userId);
        return googlePlaceSearchService.search(q, countryCode);
    }

    @GetMapping("/google/maps-key")
    public Map<String, String> googleMapsKey(
            @RequestParam String planId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        long userId = requireUser(principal);
        travelPlanService.requirePaidOwnerPlan(planId, userId);
        if (googleMapsApiKey.isBlank()) throw new IllegalStateException("Google 지도 API 키가 설정되지 않았습니다.");
        return Map.of("apiKey", googleMapsApiKey);
    }

    private long requireUser(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("로그인이 필요합니다.");
        return principal.userId();
    }
}
