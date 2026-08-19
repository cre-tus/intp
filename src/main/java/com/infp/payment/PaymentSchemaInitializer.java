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
    public void ensurePaymentSchema() {
        Integer count = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*)
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'payment_requests'
                          AND COLUMN_NAME = 'deposit_bank'
                        """,
                Integer.class
        );
        if (count == null || count == 0) {
            jdbcTemplate.execute("""
                    ALTER TABLE payment_requests
                    ADD COLUMN deposit_bank VARCHAR(100) NOT NULL DEFAULT '' COMMENT '입금 은행명'
                    AFTER depositor_name
                    """);
        }
        backfillPlanTiersFromPaymentRequests();
    }

    private void backfillPlanTiersFromPaymentRequests() {
        jdbcTemplate.update("""
                UPDATE plans p
                JOIN payment_requests pr ON pr.plan_id = p.external_id
                SET p.tier = 'PAID',
                    p.content_json = CASE
                        WHEN JSON_VALID(p.content_json) THEN JSON_SET(p.content_json, '$.tier', 'PAID')
                        ELSE p.content_json
                    END
                WHERE pr.status = 'APPROVED'
                """);
        jdbcTemplate.update("""
                UPDATE plans p
                JOIN payment_requests pr ON pr.plan_id = p.external_id
                SET p.tier = 'PENDING_PAID',
                    p.content_json = CASE
                        WHEN JSON_VALID(p.content_json) THEN JSON_SET(p.content_json, '$.tier', 'PENDING_PAID')
                        ELSE p.content_json
                    END
                WHERE pr.status = 'PENDING'
                  AND p.tier <> 'PAID'
                """);
    }
}
