package com.infp.payment.dto;

public record CreatePaymentRequest(
        String planId,
        String planTitle,
        String depositorName,
        String depositBank,
        String depositAccount
) {
}
