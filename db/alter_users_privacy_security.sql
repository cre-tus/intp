ALTER TABLE users
    ADD COLUMN password_changed_at DATETIME(6) NULL COMMENT '비밀번호 변경 시각' AFTER refresh_token_expires_at,
    ADD COLUMN terms_agreed_at DATETIME(6) NULL COMMENT '서비스 이용약관 확인 시각' AFTER password_changed_at,
    ADD COLUMN privacy_notice_confirmed_at DATETIME(6) NULL COMMENT '개인정보 처리 안내 확인 시각' AFTER terms_agreed_at,
    ADD COLUMN terms_version VARCHAR(30) NULL COMMENT '서비스 이용약관 버전' AFTER privacy_notice_confirmed_at,
    ADD COLUMN privacy_policy_version VARCHAR(30) NULL COMMENT '개인정보 처리방침 버전' AFTER terms_version;

UPDATE users
SET password_changed_at = COALESCE(password_changed_at, updated_at, created_at),
    terms_agreed_at = COALESCE(terms_agreed_at, created_at),
    privacy_notice_confirmed_at = COALESCE(privacy_notice_confirmed_at, created_at),
    terms_version = COALESCE(terms_version, 'legacy'),
    privacy_policy_version = COALESCE(privacy_policy_version, 'legacy');
