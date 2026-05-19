package com.infp.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRequestRepository extends JpaRepository<PaymentRequestEntity, Long> {
    List<PaymentRequestEntity> findAllByOrderByCreatedAtDesc();

    Optional<PaymentRequestEntity> findFirstByPlanIdAndStatusOrderByCreatedAtDesc(String planId, PaymentStatus status);
}
