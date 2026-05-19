package com.infp.payment;

import com.infp.payment.dto.CreatePaymentRequest;
import com.infp.payment.dto.PaymentRequestResponse;
import com.infp.travel.TravelPlanService;
import com.infp.user.entity.User;
import com.infp.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PaymentRequestService {
    private static final int PAID_TEMPLATE_PRICE = 3500;

    private final PaymentRequestRepository repository;
    private final UserRepository userRepository;
    private final TravelPlanService travelPlanService;

    public PaymentRequestService(PaymentRequestRepository repository, UserRepository userRepository, TravelPlanService travelPlanService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.travelPlanService = travelPlanService;
    }

    @Transactional
    public PaymentRequestResponse create(long requesterId, CreatePaymentRequest request) {
        String planId = requireText(request.planId(), "템플릿 ID가 필요합니다.");
        String planTitle = requireText(request.planTitle(), "템플릿 이름이 필요합니다.");
        String depositorName = requireText(request.depositorName(), "입금주명을 입력해 주세요.");
        String depositAccount = requireText(request.depositAccount(), "입금계좌를 입력해 주세요.");

        repository.findFirstByPlanIdAndStatusOrderByCreatedAtDesc(planId, PaymentStatus.PENDING)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("이미 승인 대기 중인 결제 요청이 있습니다.");
                });

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        PaymentRequestEntity entity = new PaymentRequestEntity();
        entity.setPlanId(planId);
        entity.setPlanTitle(planTitle);
        entity.setRequester(requester);
        entity.setDepositorName(depositorName);
        entity.setDepositAccount(depositAccount);
        entity.setAmount(PAID_TEMPLATE_PRICE);
        entity.setStatus(PaymentStatus.PENDING);
        return toResponse(repository.save(entity));
    }

    public List<PaymentRequestResponse> listAll() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PaymentRequestResponse approve(long id, long adminUserId) {
        PaymentRequestEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("결제 요청을 찾을 수 없습니다."));
        if (entity.getStatus() == PaymentStatus.APPROVED) {
            return toResponse(entity);
        }
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new IllegalArgumentException("관리자를 찾을 수 없습니다."));
        entity.setStatus(PaymentStatus.APPROVED);
        entity.setApprovedAt(LocalDateTime.now());
        entity.setApprovedBy(admin);
        travelPlanService.updateTier(entity.getPlanId(), "PAID");
        return toResponse(repository.save(entity));
    }

    private PaymentRequestResponse toResponse(PaymentRequestEntity entity) {
        User requester = entity.getRequester();
        User approver = entity.getApprovedBy();
        return new PaymentRequestResponse(
                entity.getId(),
                entity.getPlanId(),
                entity.getPlanTitle(),
                requester.getId(),
                requester.getEmail(),
                requester.getNickname(),
                entity.getDepositorName(),
                entity.getDepositAccount(),
                entity.getAmount(),
                entity.getStatus().name(),
                entity.getCreatedAt(),
                entity.getApprovedAt(),
                approver == null ? null : approver.getId(),
                approver == null ? null : approver.getEmail()
        );
    }

    private static String requireText(String value, String message) {
        if (value == null || value.trim().isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }
}
