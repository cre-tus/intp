package com.infp.travel;

import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.travel.dto.TravelPlanRequest;
import com.infp.travel.dto.TravelPlanResponse;
import com.infp.travel.dto.TravelPlanSummaryResponse;
import com.infp.travel.dto.TransferPlanOwnerRequest;
import com.infp.travel.dto.UpdateTravelPlanParticipantRoleRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/travel-plans")
public class TravelPlanController {
    private final TravelPlanService service;

    public TravelPlanController(TravelPlanService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<TravelPlanSummaryResponse>> list(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal) {
        return ResponseEntity.ok(service.list(requireUser(principal)));
    }

    @GetMapping("/shared")
    public ResponseEntity<List<TravelPlanSummaryResponse>> shared(@AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal) {
        return ResponseEntity.ok(service.listShared(requireUser(principal)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TravelPlanResponse> get(
            @PathVariable String id,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.get(id, requireUser(principal)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TravelPlanResponse> save(
            @PathVariable String id,
            @RequestBody TravelPlanRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        TravelPlanRequest normalized = new TravelPlanRequest(id, request.title(), request.template(), request.tier(), request.content());
        return ResponseEntity.ok(service.save(requireUser(principal), normalized));
    }

    @PostMapping("/{id}/autosave")
    public ResponseEntity<TravelPlanResponse> autosave(
            @PathVariable String id,
            @RequestBody TravelPlanRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        TravelPlanRequest normalized = new TravelPlanRequest(id, request.title(), request.template(), request.tier(), request.content());
        return ResponseEntity.ok(service.save(requireUser(principal), normalized));
    }

    @PostMapping("/{id}/owner")
    public ResponseEntity<TravelPlanResponse> transferOwner(
            @PathVariable String id,
            @RequestBody TransferPlanOwnerRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.transferOwner(id, requireUser(principal), request.userId()));
    }

    @PutMapping("/{id}/participants/{userId}/role")
    public ResponseEntity<TravelPlanResponse> updateParticipantRole(
            @PathVariable String id,
            @PathVariable long userId,
            @RequestBody UpdateTravelPlanParticipantRoleRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.updateParticipantRole(id, userId, requireUser(principal), request.role()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable String id,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        service.delete(id, requireUser(principal));
        return ResponseEntity.noContent().build();
    }

    private long requireUser(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("로그인이 필요합니다.");
        return principal.userId();
    }
}
