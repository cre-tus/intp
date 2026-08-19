package com.infp.admin;

import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.place.service.PlaceAutocompleteService;
import com.infp.place.service.PlaceMemoryService;
import com.infp.place.service.OverpassPlaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/admin/place-dataset")
public class AdminPlaceDatasetController {
    private final PlaceMemoryService service;
    private final PlaceAutocompleteService autocompleteService;
    private final OverpassPlaceService overpassPlaceService;
    private final String googleMapsApiKey;

    public AdminPlaceDatasetController(PlaceMemoryService service,
            PlaceAutocompleteService autocompleteService,
            OverpassPlaceService overpassPlaceService,
            @Value("${google.maps.browser-api-key:${GOOGLE_MAP_API:${GOOGLE_BROWSER_API_KEY:${GOOGLE_MAPS_API_KEY:}}}}") String googleMapsApiKey) {
        this.service = service;
        this.autocompleteService = autocompleteService;
        this.overpassPlaceService = overpassPlaceService;
        this.googleMapsApiKey = googleMapsApiKey == null ? "" : googleMapsApiKey.trim();
    }

    @GetMapping("/overpass-nearby")
    public ResponseEntity<?> overpassNearby(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "25") int radius) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        try {
            return ResponseEntity.ok(overpassPlaceService.nearby(lat, lon, radius).block(Duration.ofSeconds(35)));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (Exception exception) {
            return ResponseEntity.internalServerError().body("Overpass 주변 지물 검색에 실패했습니다: " + exception.getMessage());
        }
    }

    @GetMapping("/nominatim-search")
    public ResponseEntity<?> nominatimSearch(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestParam String q,
            @RequestParam(defaultValue = "JP") String countryCode) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(autocompleteService.searchNominatimOnly(q, countryCode).block(Duration.ofSeconds(30)));
    }

    @GetMapping("/google-maps-key")
    public ResponseEntity<?> googleMapsKey(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        if (googleMapsApiKey.isBlank()) return ResponseEntity.status(503).body("Google Maps API 키가 설정되지 않았습니다.");
        return ResponseEntity.ok(Map.of("apiKey", googleMapsApiKey));
    }

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
                                  @RequestParam(defaultValue = "") String q,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "50") int pageSize,
                                  @RequestParam(defaultValue = "review_asc") String sort,
                                  @RequestParam(defaultValue = "all") String reviewStatus,
                                  @RequestParam(defaultValue = "all") String source,
                                  @RequestParam(defaultValue = "all") String category,
                                  @RequestParam(defaultValue = "all") String placeType) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(service.adminDatasetPage(q, page, pageSize, sort, reviewStatus, source, category, placeType));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
                                    @PathVariable long id,
                                    @RequestBody PlaceMemoryService.PlaceDatasetUpdate update) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        try {
            return ResponseEntity.ok(service.adminRelabel(id, update));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (Exception exception) {
            return ResponseEntity.internalServerError().body("라벨 저장에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/{id}/replace-with-nominatim")
    public ResponseEntity<?> replaceWithNominatim(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable long id,
            @RequestBody PlaceMemoryService.PlaceDatasetReplacement replacement) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        try {
            return ResponseEntity.ok(service.replaceGoogleWithNominatim(id, replacement));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (Exception exception) {
            return ResponseEntity.internalServerError().body("Nominatim 대체에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/merge")
    public ResponseEntity<?> merge(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody PlaceMemoryService.PlaceDatasetMergeRequest request) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        try {
            return ResponseEntity.ok(service.adminMerge(request));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (Exception exception) {
            return ResponseEntity.internalServerError().body("중복 장소 병합에 실패했습니다: " + exception.getMessage());
        }
    }

    @PostMapping("/batch-merge-duplicates")
    public ResponseEntity<?> batchMergeDuplicates(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        try {
            return ResponseEntity.ok(service.adminBatchMergeDuplicates());
        } catch (Exception exception) {
            return ResponseEntity.internalServerError().body("중복 장소 일괄 병합에 실패했습니다: " + exception.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
                                    @PathVariable long id) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).build();
        try {
            return ResponseEntity.ok(service.adminDelete(id));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        } catch (Exception exception) {
            return ResponseEntity.internalServerError().body("장소 삭제에 실패했습니다: " + exception.getMessage());
        }
    }

    private boolean isAdmin(JwtAuthFilter.AuthPrincipal principal) {
        return principal != null && "ADMIN".equals(principal.role());
    }
}
