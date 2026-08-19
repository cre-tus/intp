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
        String planId = requireText(request.planId(), "여행 계획 ID가 필요합니다.");
        String planTitle = requireText(request.planTitle(), "여행 계획 이름이 필요합니다.");
        String depositorName = requireText(request.depositorName(), "입금자명을 입력해 주세요.");
        String depositBank = requireText(request.depositBank(), "은행명을 입력해 주세요.");
        String depositAccount = requireText(request.depositAccount(), "입금 계좌를 입력해 주세요.");

        if (isPaidPlan(planId, requesterId) || repository.existsByPlanIdAndStatus(planId, PaymentStatus.APPROVED)) {
            travelPlanService.updateTier(planId, "PAID");
            throw new IllegalArgumentException("이미 유료로 전환된 여행 계획입니다.");
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        PaymentRequestEntity existingPending = repository
                .findFirstByPlanIdAndStatusOrderByCreatedAtDesc(planId, PaymentStatus.PENDING)
                .orElse(null);
        if (existingPending != null) {
            if (!Boolean.TRUE.equals(request.resubmit())) {
                throw new IllegalArgumentException("이미 승인 대기 중인 결제 요청이 있습니다.");
            }
            existingPending.setPlanTitle(planTitle);
            existingPending.setRequester(requester);
            existingPending.setDepositorName(depositorName);
            existingPending.setDepositBank(depositBank);
            existingPending.setDepositAccount(depositAccount);
            existingPending.setAmount(PAID_TEMPLATE_PRICE);
            existingPending.setStatus(PaymentStatus.PENDING);
            PaymentRequestResponse response = toResponse(repository.saveAndFlush(existingPending));
            travelPlanService.updateTier(planId, "PENDING_PAID");
            return response;
        }

        PaymentRequestEntity entity = new PaymentRequestEntity();
        entity.setPlanId(planId);
        entity.setPlanTitle(planTitle);
        entity.setRequester(requester);
        entity.setDepositorName(depositorName);
        entity.setDepositBank(depositBank);
        entity.setDepositAccount(depositAccount);
        entity.setAmount(PAID_TEMPLATE_PRICE);
        entity.setStatus(PaymentStatus.PENDING);
        PaymentRequestResponse response = toResponse(repository.save(entity));
        travelPlanService.updateTier(planId, "PENDING_PAID");
        return response;
    }

    @Transactional(readOnly = true)
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
            travelPlanService.updateTier(entity.getPlanId(), "PAID");
            return toResponse(entity);
        }
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new IllegalArgumentException("관리자를 찾을 수 없습니다."));
        entity.setStatus(PaymentStatus.APPROVED);
        entity.setApprovedAt(LocalDateTime.now());
        entity.setApprovedBy(admin);
        PaymentRequestEntity saved = repository.saveAndFlush(entity);
        approveOtherPendingRequestsForSamePlan(saved.getPlanId(), admin);
        travelPlanService.updateTier(entity.getPlanId(), "PAID");
        return toResponse(saved);
    }

    private void approveOtherPendingRequestsForSamePlan(String planId, User admin) {
        List<PaymentRequestEntity> pendingRequests = repository.findAllByPlanIdAndStatus(planId, PaymentStatus.PENDING);
        if (pendingRequests.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now();
        for (PaymentRequestEntity pending : pendingRequests) {
            pending.setStatus(PaymentStatus.APPROVED);
            pending.setApprovedAt(now);
            pending.setApprovedBy(admin);
        }
        repository.saveAllAndFlush(pendingRequests);
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
                entity.getDepositBank(),
                entity.getDepositAccount(),
                entity.getAmount(),
                entity.getStatus().name(),
                entity.getCreatedAt(),
                entity.getApprovedAt(),
                approver == null ? null : approver.getId(),
                approver == null ? null : approver.getEmail()
        );
    }

    private boolean isPaidPlan(String planId, long requesterId) {
        try {
            return "PAID".equals(travelPlanService.googlePlaceTier(planId, requesterId));
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static String requireText(String value, String message) {
        if (value == null || value.trim().isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }
}
