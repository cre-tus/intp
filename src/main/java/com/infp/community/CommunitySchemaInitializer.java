package com.infp.community;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class CommunitySchemaInitializer {
    private final JdbcTemplate jdbcTemplate;

    public CommunitySchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void ensureCommunityTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_posts (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Community post PK',
                    author_id BIGINT UNSIGNED NOT NULL COMMENT 'Author user ID',
                    plan_id BIGINT UNSIGNED NULL COMMENT 'Shared travel plan ID',
                    title VARCHAR(160) NOT NULL COMMENT 'Post title',
                    city VARCHAR(80) NOT NULL COMMENT 'Main city',
                    duration VARCHAR(40) NOT NULL COMMENT 'Trip duration',
                    budget VARCHAR(40) NOT NULL COMMENT 'Trip budget label',
                    image_key VARCHAR(40) NOT NULL DEFAULT 'tokyo' COMMENT 'Representative image key',
                    image_url TEXT NULL COMMENT 'Custom representative image data URL',
                    caption TEXT NOT NULL COMMENT 'Post body',
                    tags_json TEXT NULL COMMENT 'Tag list JSON',
                    route_json TEXT NULL COMMENT 'Route list JSON',
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_community_posts_created (created_at),
                    KEY idx_community_posts_author (author_id, created_at),
                    KEY idx_community_posts_plan (plan_id),
                    CONSTRAINT fk_community_posts_author
                        FOREIGN KEY (author_id) REFERENCES users(id)
                        ON DELETE RESTRICT ON UPDATE CASCADE,
                    CONSTRAINT fk_community_posts_plan
                        FOREIGN KEY (plan_id) REFERENCES plans(id)
                        ON DELETE CASCADE ON UPDATE CASCADE
                ) COMMENT='Community travel plan sharing posts'
                """);

        if (!columnExists("community_posts", "image_url")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_posts
                    ADD COLUMN image_url TEXT NULL COMMENT 'Custom representative image data URL'
                    AFTER image_key
                    """);
        }

        ensureNullablePlanId();

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_post_likes (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Community post like PK',
                    post_id BIGINT UNSIGNED NOT NULL COMMENT 'Post ID',
                    user_id BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_community_post_like (post_id, user_id),
                    KEY idx_community_post_likes_user (user_id, created_at),
                    CONSTRAINT fk_community_post_likes_post
                        FOREIGN KEY (post_id) REFERENCES community_posts(id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT fk_community_post_likes_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE ON UPDATE CASCADE
                ) COMMENT='Community post likes'
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_post_saves (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Community post save PK',
                    post_id BIGINT UNSIGNED NOT NULL COMMENT 'Post ID',
                    user_id BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_community_post_save (post_id, user_id),
                    KEY idx_community_post_saves_user (user_id, created_at),
                    CONSTRAINT fk_community_post_saves_post
                        FOREIGN KEY (post_id) REFERENCES community_posts(id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT fk_community_post_saves_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE ON UPDATE CASCADE
                ) COMMENT='Community post saves'
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_post_comments (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Community post comment PK',
                    post_id BIGINT UNSIGNED NOT NULL COMMENT 'Post ID',
                    user_id BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
                    content VARCHAR(600) NOT NULL COMMENT 'Comment content',
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_community_post_comments_post (post_id, created_at),
                    KEY idx_community_post_comments_user (user_id, created_at),
                    CONSTRAINT fk_community_post_comments_post
                        FOREIGN KEY (post_id) REFERENCES community_posts(id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT fk_community_post_comments_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE ON UPDATE CASCADE
                ) COMMENT='Community post comments'
                """);

        if (!columnExists("community_post_comments", "updated_at")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_post_comments
                    ADD COLUMN updated_at DATETIME(6) NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6)
                    AFTER created_at
                    """);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureCommunityPostPlanNullableAfterJpa() {
        ensureNullablePlanId();
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    private void ensureNullablePlanId() {
        if (isNullable("community_posts", "plan_id")) return;
        jdbcTemplate.execute("""
                ALTER TABLE community_posts
                MODIFY COLUMN plan_id BIGINT UNSIGNED NULL COMMENT 'Shared travel plan ID'
                """);
    }

    private boolean isNullable(String tableName, String columnName) {
        String nullable = jdbcTemplate.queryForObject("""
                SELECT IS_NULLABLE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, String.class, tableName, columnName);
        return "YES".equalsIgnoreCase(nullable);
    }
}
