SET FOREIGN_KEY_CHECKS = 0;

-- ===============================
-- 기존 테이블 초기화 (개발용)
-- ===============================
DROP TABLE IF EXISTS plan_checklist_items;
DROP TABLE IF EXISTS plan_items;
DROP TABLE IF EXISTS plan_days;
DROP TABLE IF EXISTS plan_members;
DROP TABLE IF EXISTS places;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ===============================
-- 1. users (사용자 계정)
-- ===============================
CREATE TABLE users (
                       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
                       email VARCHAR(255) NOT NULL COMMENT '로그인 이메일 (유니크)',
                       password_hash VARCHAR(255) NOT NULL COMMENT '비밀번호 해시',
                       first_name VARCHAR(60) NOT NULL COMMENT '성',
                       last_name VARCHAR(60) NOT NULL COMMENT '이름',
                       nickname VARCHAR(60) NULL COMMENT '닉네임',

                       refresh_token_hash VARCHAR(255) NULL COMMENT '리프레시 토큰',
                       refresh_token_expires_at DATETIME(6) NULL COMMENT '토큰 만료시간',

                       birth DATE NULL COMMENT '생년월일',
                       status ENUM('ACTIVE','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE' COMMENT '계정 상태',
                       role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER' COMMENT '시스템 권한',

                       created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성시간',
                       updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                           ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정시간',

                       PRIMARY KEY (id),
                       UNIQUE KEY uk_users_email (email)
) COMMENT='사용자 계정 테이블';

-- ===============================
-- 2. plans (여행 계획 메인)
-- ===============================
CREATE TABLE plans (
                       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '플랜 PK',
                       owner_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 생성자',

                       title VARCHAR(120) NOT NULL COMMENT '여행 제목',
                       description TEXT NULL COMMENT '설명',

                       start_date DATE NOT NULL COMMENT '여행 시작일',
                       end_date DATE NOT NULL COMMENT '여행 종료일',

                       visibility ENUM('PRIVATE','SHARED') NOT NULL DEFAULT 'PRIVATE' COMMENT '공개 여부',

                       created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                       updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                           ON UPDATE CURRENT_TIMESTAMP(6),

                       PRIMARY KEY (id),

                       CONSTRAINT fk_plans_owner
                           FOREIGN KEY (owner_id) REFERENCES users(id)
                               ON DELETE RESTRICT ON UPDATE CASCADE
) COMMENT='여행 계획 기본 정보';

-- ===============================
-- 3. plan_members (참여자)
-- ===============================
CREATE TABLE plan_members (
                              plan_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID',
                              user_id BIGINT UNSIGNED NOT NULL COMMENT '사용자 ID',

                              role ENUM('OWNER','EDITOR','VIEWER') NOT NULL DEFAULT 'VIEWER' COMMENT '권한',
                              status ENUM('ACTIVE','PENDING') NOT NULL DEFAULT 'ACTIVE' COMMENT '참여 상태',

                              joined_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

                              PRIMARY KEY (plan_id, user_id),

                              CONSTRAINT fk_plan_members_plan
                                  FOREIGN KEY (plan_id) REFERENCES plans(id)
                                      ON DELETE CASCADE ON UPDATE CASCADE,

                              CONSTRAINT fk_plan_members_user
                                  FOREIGN KEY (user_id) REFERENCES users(id)
                                      ON DELETE RESTRICT ON UPDATE CASCADE
) COMMENT='플랜 참여자 및 권한';

-- ===============================
-- 4. plan_days (Day1, Day2 ...)
-- ===============================
CREATE TABLE plan_days (
                           id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '일차 PK',

                           plan_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID',
                           day_number INT UNSIGNED NOT NULL COMMENT 'n일차 (Day1, Day2)',
                           `date` DATE NOT NULL COMMENT '해당 날짜',

                           created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                           updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                               ON UPDATE CURRENT_TIMESTAMP(6),

                           PRIMARY KEY (id),

                           UNIQUE KEY uk_plan_days_plan_daynum (plan_id, day_number),

                           CONSTRAINT fk_plan_days_plan
                               FOREIGN KEY (plan_id) REFERENCES plans(id)
                                   ON DELETE CASCADE ON UPDATE CASCADE
) COMMENT='여행 일차 정보';

-- ===============================
-- 5. places (장소 DB)
-- ===============================
CREATE TABLE places (
                        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '장소 PK',

                        source VARCHAR(40) NOT NULL DEFAULT 'manual' COMMENT '출처',
                        source_place_id VARCHAR(128) NOT NULL COMMENT '외부 ID',

                        name VARCHAR(200) NOT NULL COMMENT '장소 이름',
                        address VARCHAR(400) NULL COMMENT '주소',

                        latitude DECIMAL(10,7) NULL COMMENT '위도',
                        longitude DECIMAL(10,7) NULL COMMENT '경도',

                        category VARCHAR(80) NULL COMMENT '카테고리',

                        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                            ON UPDATE CURRENT_TIMESTAMP(6),

                        PRIMARY KEY (id),

                        UNIQUE KEY uk_places_source_ext (source, source_place_id)
) COMMENT='장소 마스터 테이블';

-- ===============================
-- 6. plan_items (일정 상세)
-- ===============================
CREATE TABLE plan_items (
                            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '일정 PK',

                            plan_day_id BIGINT UNSIGNED NOT NULL COMMENT 'Day ID',
                            place_id BIGINT UNSIGNED NULL COMMENT '장소 ID',

                            sort_order INT UNSIGNED NOT NULL COMMENT '순서 (1,2,3...)',

                            start_time TIME NULL COMMENT '시작 시간',
                            end_time TIME NULL COMMENT '종료 시간',

                            activity VARCHAR(400) NULL COMMENT '활동 내용',
                            memo VARCHAR(800) NULL COMMENT '메모',

                            cost INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '경비',

                            created_by BIGINT UNSIGNED NULL COMMENT '작성자',

                            created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                            updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                ON UPDATE CURRENT_TIMESTAMP(6),

                            PRIMARY KEY (id),

                            CONSTRAINT fk_plan_items_day
                                FOREIGN KEY (plan_day_id) REFERENCES plan_days(id)
                                    ON DELETE CASCADE,

                            CONSTRAINT fk_plan_items_place
                                FOREIGN KEY (place_id) REFERENCES places(id)
                                    ON DELETE SET NULL
) COMMENT='일정 (시간/장소/비용)';

-- ===============================
-- 7. plan_checklist_items (준비물)
-- ===============================
CREATE TABLE plan_checklist_items (
                                      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '준비물 PK',

                                      plan_id BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID',

                                      item_name VARCHAR(200) NOT NULL COMMENT '준비물 이름',
                                      cost INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '가격',

                                      is_checked BOOLEAN NOT NULL DEFAULT FALSE COMMENT '체크 여부',

                                      sort_order INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '순서',

                                      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                                      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                          ON UPDATE CURRENT_TIMESTAMP(6),

                                      PRIMARY KEY (id),

                                      CONSTRAINT fk_checklist_plan
                                          FOREIGN KEY (plan_id) REFERENCES plans(id)
                                              ON DELETE CASCADE
) COMMENT='여행 준비물 체크리스트';
