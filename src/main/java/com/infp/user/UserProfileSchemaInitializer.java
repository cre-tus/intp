package com.infp.user;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class UserProfileSchemaInitializer {
    private final JdbcTemplate jdbcTemplate;

    public UserProfileSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void ensureUserProfileColumns() {
        if (!columnExists("status_message")) {
            jdbcTemplate.execute("""
                    ALTER TABLE users
                    ADD COLUMN status_message VARCHAR(160) NULL
                    AFTER nickname
                    """);
        }
        if (!columnExists("profile_image_url")) {
            jdbcTemplate.execute("""
                    ALTER TABLE users
                    ADD COLUMN profile_image_url LONGTEXT NULL
                    AFTER status_message
                    """);
        }
    }

    private boolean columnExists(String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = ?
                """, Integer.class, columnName);
        return count != null && count > 0;
    }
}
