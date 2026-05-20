package com.infp.admin;

import com.infp.admin.dto.ServerTestJobStartResponse;
import com.infp.admin.dto.ServerTestJobStatusResponse;
import com.infp.admin.dto.ServerTestRequest;
import com.infp.admin.dto.ServerTestShuffleJobStatusResponse;
import com.infp.admin.dto.ServerTestShuffleResponse;
import com.infp.auth.jwt.JwtAuthFilter;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminServerTestController {

    private final AdminServerTestService adminServerTestService;

    public AdminServerTestController(AdminServerTestService adminServerTestService) {
        this.adminServerTestService = adminServerTestService;
    }

    @PostMapping("/server-test")
    public ResponseEntity<?> runServerTest(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody ServerTestRequest request
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        if (!"ADMIN".equals(principal.role())) {
            return ResponseEntity.status(403).build();
        }
        try {
            return ResponseEntity.ok(adminServerTestService.run(request.nodeCount(), request.userCount(), request.users()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        }
    }

    @PostMapping("/server-test/start")
    public ResponseEntity<?> startServerTest(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody ServerTestRequest request
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        if (!"ADMIN".equals(principal.role())) {
            return ResponseEntity.status(403).build();
        }
        try {
            ServerTestJobStartResponse response = adminServerTestService.startJob(request.nodeCount(), request.userCount(), request.shuffleJobId(), request.users());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        }
    }

    @GetMapping("/server-test/jobs/{jobId}")
    public ResponseEntity<?> getServerTestJob(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        if (!"ADMIN".equals(principal.role())) {
            return ResponseEntity.status(403).build();
        }
        ServerTestJobStatusResponse response = adminServerTestService.jobStatus(jobId);
        return response == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(response);
    }

    @PostMapping("/server-test/shuffle")
    public ResponseEntity<ServerTestShuffleResponse> shuffleServerTestNodes(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody ServerTestRequest request
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        if (!"ADMIN".equals(principal.role())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(adminServerTestService.shuffle(request.nodeCount(), request.userCount()));
    }

    @PostMapping("/server-test/shuffle/start")
    public ResponseEntity<?> startServerTestShuffle(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody ServerTestRequest request
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        if (!"ADMIN".equals(principal.role())) {
            return ResponseEntity.status(403).build();
        }
        try {
            ServerTestJobStartResponse response = adminServerTestService.startShuffleJob(request.nodeCount(), request.userCount());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        }
    }

    @GetMapping("/server-test/shuffle/jobs/{jobId}")
    public ResponseEntity<?> getServerTestShuffleJob(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable String jobId
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        if (!"ADMIN".equals(principal.role())) {
            return ResponseEntity.status(403).build();
        }
        ServerTestShuffleJobStatusResponse response = adminServerTestService.shuffleJobStatus(jobId);
        return response == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(response);
    }
}
