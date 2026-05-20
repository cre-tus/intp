SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS payment_requests;
DROP TABLE IF EXISTS plan_checklist_items;
DROP TABLE IF EXISTS plan_spreadsheet_cells;
DROP TABLE IF EXISTS plan_items;
DROP TABLE IF EXISTS plan_days;
DROP TABLE IF EXISTS plan_members;
DROP TABLE IF EXISTS places;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
    email VARCHAR(255) NOT NULL COMMENT '로그인 이메일',
    password_hash VARCHAR(255) NOT NULL COMMENT '비밀번호 해시',
    first_name VARCHAR(60) NOT NULL COMMENT '성',
    last_name VARCHAR(60) NOT NULL COMMENT '이름',
    nickname VARCHAR(60) NULL COMMENT '닉네임',
    refresh_token_hash VARCHAR(255) NULL COMMENT '리프레시 토큰 해시',
    refresh_token_expires_at DATETIME(6) NULL COMMENT '리프레시 토큰 만료',
    birth DATE NULL COMMENT '생년월일',
    status ENUM('ACTIVE','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE' COMMENT '계정 상태',
    role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER' COMMENT '시스템 권한',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) COMMENT='사용자 계정';

CREATE TABLE plans (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '플랜 내부 PK',
    external_id VARCHAR(100) NULL COMMENT '프론트/공유 URL용 계획 UUID',
    owner_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 생성자',
    title VARCHAR(120) NOT NULL COMMENT '여행 제목',
    description TEXT NULL COMMENT '설명',
    start_date DATE NOT NULL COMMENT '여행 시작일',
    end_date DATE NOT NULL COMMENT '여행 종료일',
    visibility ENUM('PRIVATE','SHARED') NOT NULL DEFAULT 'PRIVATE' COMMENT '공개 여부',
    template ENUM('basic','spreadsheet') NOT NULL DEFAULT 'basic' COMMENT '템플릿 형식',
    tier ENUM('FREE','PENDING_PAID','PAID') NOT NULL DEFAULT 'FREE' COMMENT '템플릿 결제 등급',
    content_json LONGTEXT NULL COMMENT '프론트 여행 계획 전체 JSON 스냅샷',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_plans_external_id (external_id),
    KEY idx_plans_owner_updated (owner_id, updated_at),
    CONSTRAINT fk_plans_owner
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) COMMENT='여행 계획 메인';

CREATE TABLE plan_members (
    plan_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID',
    user_id BIGINT UNSIGNED NOT NULL COMMENT '사용자 ID',
    role ENUM('OWNER','EDITOR','VIEWER') NOT NULL DEFAULT 'VIEWER' COMMENT '권한',
    status ENUM('ACTIVE','PENDING') NOT NULL DEFAULT 'ACTIVE' COMMENT '참여 상태',
    joined_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (plan_id, user_id),
    KEY idx_plan_members_user (user_id, status),
    CONSTRAINT fk_plan_members_plan
        FOREIGN KEY (plan_id) REFERENCES plans(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_plan_members_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) COMMENT='플랜 참여자 및 권한';

CREATE TABLE plan_days (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '일차 PK',
    plan_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID',
    external_day_id VARCHAR(100) NULL COMMENT '프론트 Day UUID',
    day_number INT UNSIGNED NOT NULL COMMENT 'n일차',
    `date` DATE NULL COMMENT '해당 날짜',
    title VARCHAR(120) NULL COMMENT 'Day 표시 제목',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_days_plan_daynum (plan_id, day_number),
    KEY idx_plan_days_external (external_day_id),
    CONSTRAINT fk_plan_days_plan
        FOREIGN KEY (plan_id) REFERENCES plans(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) COMMENT='여행 일차 정보';

CREATE TABLE places (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '장소 PK',
    source VARCHAR(40) NOT NULL DEFAULT 'manual' COMMENT '출처',
    source_place_id VARCHAR(128) NOT NULL COMMENT '외부 장소 ID',
    name VARCHAR(200) NOT NULL COMMENT '장소 이름',
    address VARCHAR(400) NULL COMMENT '주소',
    latitude DECIMAL(10,7) NULL COMMENT '위도',
    longitude DECIMAL(10,7) NULL COMMENT '경도',
    category VARCHAR(80) NULL COMMENT '카테고리',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_places_source_ext (source, source_place_id),
    KEY idx_places_lat_lon (latitude, longitude)
) COMMENT='장소 마스터';

CREATE TABLE plan_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '일정 PK',
    plan_day_id BIGINT UNSIGNED NOT NULL COMMENT 'Day ID',
    external_activity_id VARCHAR(100) NULL COMMENT '프론트 활동 UUID',
    place_id BIGINT UNSIGNED NULL COMMENT '장소 ID',
    sort_order INT UNSIGNED NOT NULL COMMENT '순서',
    start_time TIME NULL COMMENT '시작 시간',
    end_time TIME NULL COMMENT '종료 시간',
    activity VARCHAR(400) NULL COMMENT '활동 내용',
    memo VARCHAR(800) NULL COMMENT '메모',
    cost INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '경비',
    route_role ENUM('NONE','LODGING','START','END','FIXED') NOT NULL DEFAULT 'NONE' COMMENT '경로 최적화 역할',
    created_by BIGINT UNSIGNED NULL COMMENT '작성자',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_plan_items_day_order (plan_day_id, sort_order),
    KEY idx_plan_items_external (external_activity_id),
    CONSTRAINT fk_plan_items_day
        FOREIGN KEY (plan_day_id) REFERENCES plan_days(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_plan_items_place
        FOREIGN KEY (place_id) REFERENCES places(id)
        ON DELETE SET NULL
) COMMENT='기본형 일정 상세';

CREATE TABLE plan_spreadsheet_cells (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '엑셀형 셀 PK',
    plan_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID',
    external_day_id VARCHAR(100) NULL COMMENT '프론트 Day UUID',
    external_activity_id VARCHAR(100) NULL COMMENT '프론트 셀/활동 UUID',
    day_number INT UNSIGNED NOT NULL COMMENT 'n일차',
    row_order INT UNSIGNED NOT NULL COMMENT '행 순서',
    row_key VARCHAR(160) NOT NULL COMMENT '행 키',
    row_label VARCHAR(120) NOT NULL COMMENT '행 표시 이름',
    cell_value TEXT NULL COMMENT '셀 입력값',
    cost INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '비용 행 숫자값',
    place_id VARCHAR(128) NULL COMMENT '외부 장소 ID',
    place_subtitle VARCHAR(400) NULL COMMENT '장소 보조 설명',
    latitude DECIMAL(10,7) NULL COMMENT '위도',
    longitude DECIMAL(10,7) NULL COMMENT '경도',
    route_role ENUM('NONE','LODGING','START','END','FIXED') NOT NULL DEFAULT 'NONE' COMMENT '경로 최적화 역할',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_spreadsheet_cell (plan_id, external_day_id, row_key),
    KEY idx_plan_spreadsheet_cells_plan_day (plan_id, day_number),
    KEY idx_plan_spreadsheet_cells_cost (plan_id, cost),
    KEY idx_plan_spreadsheet_cells_route (plan_id, route_role),
    CONSTRAINT fk_plan_spreadsheet_cells_plan
        FOREIGN KEY (plan_id) REFERENCES plans(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) COMMENT='엑셀형 여행 템플릿 셀';

CREATE TABLE plan_checklist_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '준비물 PK',
    plan_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID',
    external_item_id VARCHAR(100) NULL COMMENT '프론트 체크리스트 UUID',
    item_name VARCHAR(200) NOT NULL COMMENT '준비물 이름',
    cost INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '가격',
    is_checked BOOLEAN NOT NULL DEFAULT FALSE COMMENT '체크 여부',
    sort_order INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '순서',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_checklist_plan_order (plan_id, sort_order),
    CONSTRAINT fk_checklist_plan
        FOREIGN KEY (plan_id) REFERENCES plans(id)
        ON DELETE CASCADE
) COMMENT='여행 준비물 체크리스트';

CREATE TABLE payment_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '결제 요청 PK',
    plan_id VARCHAR(100) NOT NULL COMMENT '템플릿 external_id',
    plan_title VARCHAR(200) NOT NULL COMMENT '템플릿 제목',
    requester_user_id BIGINT UNSIGNED NOT NULL COMMENT '요청 사용자',
    depositor_name VARCHAR(100) NOT NULL COMMENT '입금자명',
    deposit_bank VARCHAR(100) NOT NULL DEFAULT '' COMMENT '입금 은행명',
    deposit_account VARCHAR(100) NOT NULL COMMENT '입금 계좌번호',
    amount INT UNSIGNED NOT NULL DEFAULT 3500 COMMENT '금액',
    status ENUM('PENDING','APPROVED') NOT NULL DEFAULT 'PENDING' COMMENT '처리 상태',
    approved_by_user_id BIGINT UNSIGNED NULL COMMENT '승인 관리자',
    approved_at DATETIME(6) NULL COMMENT '승인 일시',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_payment_requests_plan_status (plan_id, status),
    KEY idx_payment_requests_requester (requester_user_id),
    CONSTRAINT fk_payment_requests_requester
        FOREIGN KEY (requester_user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_payment_requests_approver
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) COMMENT='유료 템플릿 결제 요청';
