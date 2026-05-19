package com.infp.payment;

import com.infp.auth.jwt.JwtAuthFilter;
import com.infp.payment.dto.CreatePaymentRequest;
import com.infp.payment.dto.PaymentRequestResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
public class PaymentRequestController {
    private final PaymentRequestService service;

    public PaymentRequestController(PaymentRequestService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<PaymentRequestResponse> create(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @RequestBody CreatePaymentRequest request
    ) {
        return ResponseEntity.ok(service.create(requireUser(principal), request));
    }

    @GetMapping
    public ResponseEntity<List<PaymentRequestResponse>> list(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal
    ) {
        requireAdmin(principal);
        return ResponseEntity.ok(service.listAll());
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<PaymentRequestResponse> approve(
            @AuthenticationPrincipal JwtAuthFilter.AuthPrincipal principal,
            @PathVariable long id
    ) {
        long adminUserId = requireAdmin(principal);
        return ResponseEntity.ok(service.approve(id, adminUserId));
    }

    private long requireUser(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        return principal.userId();
    }

    private long requireAdmin(JwtAuthFilter.AuthPrincipal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        if (!"ADMIN".equals(principal.role())) {
            throw new IllegalArgumentException("관리자만 사용할 수 있습니다.");
        }
        return principal.userId();
    }
}
