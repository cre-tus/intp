package com.infp.payment.dto;

import java.time.LocalDateTime;

public record PaymentRequestResponse(
        Long id,
        String planId,
        String planTitle,
        Long requesterUserId,
        String requesterEmail,
        String requesterNickname,
        String depositorName,
        String depositBank,
        String depositAccount,
        int amount,
        String status,
        LocalDateTime createdAt,
        LocalDateTime approvedAt,
        Long approvedByUserId,
        String approvedByEmail
) {
}
