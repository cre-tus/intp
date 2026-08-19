package com.infp.place.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GooglePlaceRetentionService {
    private final JdbcTemplate jdbcTemplate;

    public GooglePlaceRetentionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(initialDelay = 5_000, fixedDelay = 3_600_000)
    @Transactional
    public void purgeExpiredGoogleSourceData() {
        jdbcTemplate.update("""
                INSERT INTO retained_google_place_ids (place_id, first_seen_at, last_seen_at)
                SELECT COALESCE(NULLIF(google_place_id, ''), source_place_id), created_at, NOW(6)
                FROM place_memory
                WHERE UPPER(source) = 'GOOGLE' AND source_data_expires_at <= NOW(6)
                ON DUPLICATE KEY UPDATE last_seen_at = VALUES(last_seen_at)
                """);
        jdbcTemplate.update("""
                DELETE psl FROM place_search_learning psl
                JOIN place_memory pm ON pm.source = psl.source AND pm.source_place_id = psl.source_place_id
                WHERE UPPER(pm.source) = 'GOOGLE' AND pm.source_data_expires_at <= NOW(6)
                """);
        jdbcTemplate.update("""
                DELETE FROM place_memory
                WHERE UPPER(source) = 'GOOGLE' AND source_data_expires_at <= NOW(6)
                """);
    }
}
