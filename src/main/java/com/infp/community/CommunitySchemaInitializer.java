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
                    post_type VARCHAR(20) NOT NULL DEFAULT 'plan' COMMENT 'Post type: plan/photo/qna',
                    title VARCHAR(160) NOT NULL COMMENT 'Post title',
                    city VARCHAR(80) NOT NULL COMMENT 'Main city',
                    duration VARCHAR(40) NOT NULL COMMENT 'Trip duration',
                    budget VARCHAR(40) NOT NULL COMMENT 'Trip budget label',
                    image_key VARCHAR(40) NOT NULL DEFAULT 'tokyo' COMMENT 'Representative image key',
                    image_url LONGTEXT NULL COMMENT 'Custom representative image data URL',
                    media_type VARCHAR(20) NULL COMMENT 'Attached Q&A media type',
                    media_url LONGTEXT NULL COMMENT 'Attached Q&A media data URL',
                    caption TEXT NOT NULL COMMENT 'Post body',
                    question_detail TEXT NULL COMMENT 'Q&A question detail',
                    attempted TEXT NULL COMMENT 'What the author already tried',
                    answer_preference VARCHAR(160) NULL COMMENT 'Preferred answer style',
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
                    ADD COLUMN image_url LONGTEXT NULL COMMENT 'Custom representative image data URL'
                    AFTER image_key
                    """);
        }
        ensureLongText("community_posts", "image_url", "Custom representative image data URL");

        if (!columnExists("community_posts", "media_type")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_posts
                    ADD COLUMN media_type VARCHAR(20) NULL COMMENT 'Attached Q&A media type'
                    AFTER image_url
                    """);
        }

        if (!columnExists("community_posts", "media_url")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_posts
                    ADD COLUMN media_url LONGTEXT NULL COMMENT 'Attached Q&A media data URL'
                    AFTER media_type
                    """);
        }
        ensureLongText("community_posts", "media_url", "Attached Q&A media data URL");

        if (!columnExists("community_posts", "post_type")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_posts
                    ADD COLUMN post_type VARCHAR(20) NOT NULL DEFAULT 'plan' COMMENT 'Post type: plan/photo/qna'
                    AFTER plan_id
                    """);
        }

        if (!columnExists("community_posts", "question_detail")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_posts
                    ADD COLUMN question_detail TEXT NULL COMMENT 'Q&A question detail'
                    AFTER caption
                    """);
        }

        if (!columnExists("community_posts", "attempted")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_posts
                    ADD COLUMN attempted TEXT NULL COMMENT 'What the author already tried'
                    AFTER question_detail
                    """);
        }

        if (!columnExists("community_posts", "answer_preference")) {
            jdbcTemplate.execute("""
                    ALTER TABLE community_posts
                    ADD COLUMN answer_preference VARCHAR(160) NULL COMMENT 'Preferred answer style'
                    AFTER attempted
                    """);
        }

        ensureNullablePlanId();

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_post_media (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Community post media PK',
                    post_id BIGINT UNSIGNED NOT NULL COMMENT 'Community post ID',
                    media_type VARCHAR(20) NOT NULL COMMENT 'Media type: image/video',
                    storage_url VARCHAR(600) NOT NULL COMMENT 'Local or CDN media URL',
                    original_filename VARCHAR(255) NULL COMMENT 'Original file name',
                    mime_type VARCHAR(120) NULL COMMENT 'Uploaded MIME type',
                    size_bytes BIGINT NULL COMMENT 'File size in bytes',
                    duration_seconds INT NULL COMMENT 'Video duration seconds',
                    sort_order INT NOT NULL DEFAULT 0 COMMENT 'Media display order',
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_community_post_media_post (post_id, sort_order, id),
                    CONSTRAINT fk_community_post_media_post
                        FOREIGN KEY (post_id) REFERENCES community_posts(id)
                        ON DELETE CASCADE ON UPDATE CASCADE
                ) COMMENT='Community post media metadata'
                """);

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

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS community_post_comment_likes (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Comment like PK',
                    comment_id BIGINT UNSIGNED NOT NULL COMMENT 'Comment ID',
                    user_id BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_community_comment_like (comment_id, user_id),
                    KEY idx_community_comment_likes_user (user_id, created_at),
                    CONSTRAINT fk_community_comment_likes_comment
                        FOREIGN KEY (comment_id) REFERENCES community_post_comments(id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT fk_community_comment_likes_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE ON UPDATE CASCADE
                ) COMMENT='Community answer likes'
                """);
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

    private void ensureLongText(String tableName, String columnName, String comment) {
        String dataType = jdbcTemplate.queryForObject("""
                SELECT DATA_TYPE
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, String.class, tableName, columnName);
        if ("longtext".equalsIgnoreCase(dataType)) return;
        jdbcTemplate.execute("ALTER TABLE " + tableName + " MODIFY COLUMN " + columnName + " LONGTEXT NULL COMMENT '" + comment + "'");
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
