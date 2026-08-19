package com.infp.travel;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class TravelPlanSchemaInitializer {
    private final JdbcTemplate jdbcTemplate;

    public TravelPlanSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void ensureTravelPlanSchema() {
        jdbcTemplate.execute("""
                ALTER TABLE plans
                MODIFY COLUMN template ENUM('basic','spreadsheet','timeline','route_sheet') NOT NULL DEFAULT 'basic' COMMENT '템플릿 형식'
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ml_training_plan_snapshots (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    plan_external_id_hash CHAR(64) NOT NULL UNIQUE,
                    owner_age_bucket VARCHAR(20) NOT NULL DEFAULT 'unknown',
                    start_date DATE NULL,
                    end_date DATE NULL,
                    completed_days INT NOT NULL DEFAULT 0,
                    place_count INT NOT NULL DEFAULT 0,
                    content_json LONGTEXT NOT NULL,
                    source_updated_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    INDEX idx_ml_training_plan_snapshots_quality (completed_days, place_count),
                    INDEX idx_ml_training_plan_snapshots_updated_at (updated_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """);
    }
}
