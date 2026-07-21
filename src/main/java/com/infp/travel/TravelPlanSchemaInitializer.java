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
    public void ensureTravelPlanTemplateValues() {
        jdbcTemplate.execute("""
                ALTER TABLE plans
                MODIFY COLUMN template ENUM('basic','spreadsheet','timeline','route_sheet') NOT NULL DEFAULT 'basic' COMMENT '템플릿 형식'
                """);
    }
}
