package com.infp.plan.collaboration;

import com.infp.auth.jwt.JwtAuthFilter;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/plans/{planId}/participants")
public class PlanCollaborationController {

    private final PlanCollaborationService service;

    public PlanCollaborationController(PlanCollaborationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<PlanParticipantDto>> participants(
            @PathVariable long planId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.participants(planId, userId(principal)));
    }

    @PostMapping
    public ResponseEntity<PlanParticipantDto> addParticipant(
            @PathVariable long planId,
            @RequestBody AddPlanParticipantRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.addParticipant(planId, userId(principal), request));
    }

    @PatchMapping("/{userId}")
    public ResponseEntity<PlanParticipantDto> updateRole(
            @PathVariable long planId,
            @PathVariable long userId,
            @RequestBody UpdatePlanParticipantRoleRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.updateRole(planId, userId, userId(principal), request));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> removeParticipant(
            @PathVariable long planId,
            @PathVariable long userId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        service.removeParticipant(planId, userId, userId(principal));
        return ResponseEntity.noContent().build();
    }

    private long userId(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        return principal.userId();
    }
}
