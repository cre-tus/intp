CREATE TABLE community_posts (
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
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
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
) COMMENT='Community travel plan sharing posts';

CREATE TABLE community_post_likes (
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
) COMMENT='Community post likes';

CREATE TABLE community_post_saves (
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
) COMMENT='Community post saves';

CREATE TABLE community_post_comments (
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
) COMMENT='Community post comments';
