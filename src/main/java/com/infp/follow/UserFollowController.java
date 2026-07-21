package com.infp.follow;

import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.follow.dto.FollowStatsResponse;
import com.infp.follow.dto.FollowStatusResponse;
import com.infp.follow.dto.FollowUserResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/follows")
public class UserFollowController {
    private final UserFollowService service;

    public UserFollowController(UserFollowService service) {
        this.service = service;
    }

    @GetMapping("/me/stats")
    public ResponseEntity<FollowStatsResponse> myStats(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.stats(requireUser(principal)));
    }

    @GetMapping("/me/followers")
    public ResponseEntity<List<FollowUserResponse>> myFollowers(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.followers(requireUser(principal)));
    }

    @GetMapping("/me/following")
    public ResponseEntity<List<FollowUserResponse>> myFollowing(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.following(requireUser(principal)));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<FollowStatusResponse> status(
            @PathVariable long userId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.status(requireUser(principal), userId));
    }

    @PostMapping("/users/{userId}/toggle")
    public ResponseEntity<FollowStatusResponse> toggle(
            @PathVariable long userId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.toggle(requireUser(principal), userId));
    }

    private long requireUser(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("로그인이 필요합니다.");
        return principal.userId();
    }
}
