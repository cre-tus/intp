CREATE TABLE user_follows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'User follow PK',
    follower_id BIGINT UNSIGNED NOT NULL COMMENT 'Follower user ID',
    following_id BIGINT UNSIGNED NOT NULL COMMENT 'Following user ID',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_follow (follower_id, following_id),
    KEY idx_user_follows_follower (follower_id, created_at),
    KEY idx_user_follows_following (following_id, created_at),
    CONSTRAINT fk_user_follows_follower
        FOREIGN KEY (follower_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_user_follows_following
        FOREIGN KEY (following_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) COMMENT='User follow relationships';
