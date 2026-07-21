package com.infp.community;

import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.community.dto.CommunityPostCommentRequest;
import com.infp.community.dto.CommunityPostCommentResponse;
import com.infp.community.dto.CommunityPostReactionResponse;
import com.infp.community.dto.CommunityPostRequest;
import com.infp.community.dto.CommunityPostResponse;
import com.infp.community.dto.CommunityPlanViewResponse;
import com.infp.community.dto.CommunityUserProfileResponse;
import com.infp.travel.dto.TravelPlanResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/community/posts")
public class CommunityController {
    private final CommunityService service;

    public CommunityController(CommunityService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<CommunityPostResponse>> list(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.list(principal == null ? null : principal.userId()));
    }

    @GetMapping("/me")
    public ResponseEntity<List<CommunityPostResponse>> myPosts(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.myPosts(requireUser(principal)));
    }

    @GetMapping("/users/{userId}/profile")
    public ResponseEntity<CommunityUserProfileResponse> userProfile(
            @PathVariable long userId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.userProfile(principal == null ? null : principal.userId(), userId));
    }

    @GetMapping("/saved")
    public ResponseEntity<List<CommunityPostResponse>> savedPosts(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.savedPosts(requireUser(principal)));
    }

    @GetMapping("/following")
    public ResponseEntity<List<CommunityPostResponse>> followingPosts(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.followingPosts(requireUser(principal)));
    }

    @GetMapping("/popular")
    public ResponseEntity<List<CommunityPostResponse>> popularPosts(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.popularPosts(principal == null ? null : principal.userId()));
    }

    @GetMapping("/search")
    public ResponseEntity<List<CommunityPostResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String region,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.search(principal == null ? null : principal.userId(), q, region));
    }

    @GetMapping("/regions")
    public ResponseEntity<List<String>> regions(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(service.regions(q));
    }

    @PostMapping
    public ResponseEntity<CommunityPostResponse> create(
            @RequestBody CommunityPostRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.create(requireUser(principal), request));
    }

    @PutMapping("/{postId}")
    public ResponseEntity<CommunityPostResponse> update(
            @PathVariable long postId,
            @RequestBody CommunityPostRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.update(requireUser(principal), postId, request));
    }

    @PostMapping("/{postId}/like")
    public ResponseEntity<CommunityPostReactionResponse> like(
            @PathVariable long postId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.toggleLike(requireUser(principal), postId));
    }

    @GetMapping("/{postId}/plan")
    public ResponseEntity<CommunityPlanViewResponse> sharedPlan(@PathVariable long postId) {
        return ResponseEntity.ok(service.getSharedPlan(postId));
    }

    @PostMapping("/{postId}/plan/copy")
    public ResponseEntity<TravelPlanResponse> copySharedPlan(
            @PathVariable long postId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.copySharedPlan(requireUser(principal), postId));
    }

    @PostMapping("/{postId}/save")
    public ResponseEntity<CommunityPostReactionResponse> save(
            @PathVariable long postId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.toggleSave(requireUser(principal), postId));
    }

    @GetMapping("/{postId}/comments")
    public ResponseEntity<List<CommunityPostCommentResponse>> comments(
            @PathVariable long postId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.comments(postId, principal == null ? null : principal.userId()));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<CommunityPostCommentResponse> addComment(
            @PathVariable long postId,
            @RequestBody CommunityPostCommentRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.addComment(requireUser(principal), postId, request));
    }

    @PutMapping("/{postId}/comments/{commentId}")
    public ResponseEntity<CommunityPostCommentResponse> updateComment(
            @PathVariable long postId,
            @PathVariable long commentId,
            @RequestBody CommunityPostCommentRequest request,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        return ResponseEntity.ok(service.updateComment(requireUser(principal), postId, commentId, request));
    }

    @DeleteMapping("/{postId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable long postId,
            @PathVariable long commentId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        service.deleteComment(requireUser(principal), postId, commentId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(
            @PathVariable long postId,
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        service.deletePost(requireUser(principal), postId);
        return ResponseEntity.noContent().build();
    }

    private long requireUser(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("로그인이 필요합니다.");
        return principal.userId();
    }
}
