package com.infp.payment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

@Component
public class PaymentSchemaInitializer {
    private final JdbcTemplate jdbcTemplate;

    public PaymentSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void ensureDepositBankColumn() {
        Integer count = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*)
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'payment_requests'
                          AND COLUMN_NAME = 'deposit_bank'
                        """,
                Integer.class
        );
        if (count != null && count > 0) return;

        jdbcTemplate.execute("""
                ALTER TABLE payment_requests
                ADD COLUMN deposit_bank VARCHAR(100) NOT NULL DEFAULT '' COMMENT '입금 은행명'
                AFTER depositor_name
                """);
    }
}
