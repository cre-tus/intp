/* =========================================================
   INF-P Trip Planner (MySQL) - Core Schema
   - plans: 여행 계획(기간/기본정보)
   - plan_days: n일차 + 실제 날짜(핵심)
   - places: 장소 마스터(지도/검색 기반)
   - plan_items: 하루 내 일정(순서/시간/메모)
   - plan_members: 공동 편집/권한
   - users: 사용자
   ========================================================= */

-- 안전하게 재실행 가능하도록 FK 체크 끄고 드랍(개발용)
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS plan_items;
DROP TABLE IF EXISTS plan_days;
DROP TABLE IF EXISTS plan_members;
DROP TABLE IF EXISTS places;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------
-- 1) users: 사용자
-- ---------------------------------------------------------
CREATE TABLE users (
                       id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
                       email         VARCHAR(255)     NOT NULL COMMENT '로그인 식별 이메일(유니크)',
                       password_hash VARCHAR(255)     NOT NULL COMMENT '비밀번호 해시(평문 저장 금지)',
                       nickname      VARCHAR(60)      NULL     COMMENT '표시 이름(닉네임)',
                       status        ENUM('ACTIVE','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE' COMMENT '계정 상태',
                       created_at    DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
                       updated_at    DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                              ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
                       PRIMARY KEY (id),
                       UNIQUE KEY uk_users_email (email),
                       KEY idx_users_status (status)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='사용자 계정 테이블';

-- ---------------------------------------------------------
-- 2) plans: 여행 계획(기간의 틀)
-- ---------------------------------------------------------
CREATE TABLE plans (
                       id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '플랜 PK',
                       owner_id    BIGINT UNSIGNED NOT NULL COMMENT '플랜 소유자(users.id)',
                       title       VARCHAR(120)    NOT NULL COMMENT '플랜 제목',
                       description TEXT            NULL     COMMENT '플랜 설명(선택)',
                       start_date  DATE            NOT NULL COMMENT '여행 시작일(1일차 날짜)',
                       end_date    DATE            NOT NULL COMMENT '여행 종료일(마지막 일차 날짜)',
                       visibility  ENUM('PRIVATE','SHARED') NOT NULL DEFAULT 'PRIVATE' COMMENT '공유 여부(간단 플래그)',
                       created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
                       updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                           ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
                       PRIMARY KEY (id),
                       KEY idx_plans_owner (owner_id),
                       KEY idx_plans_dates (start_date, end_date),
                       CONSTRAINT fk_plans_owner
                           FOREIGN KEY (owner_id) REFERENCES users(id)
                               ON DELETE RESTRICT
                               ON UPDATE CASCADE,
                       CONSTRAINT chk_plans_date_range
                           CHECK (start_date <= end_date)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='여행 계획(기간/기본정보)';

-- ---------------------------------------------------------
-- 3) plan_members: 플랜 참여자/권한 (공동 편집 핵심)
-- ---------------------------------------------------------
CREATE TABLE plan_members (
                              plan_id    BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID(plans.id)',
                              user_id    BIGINT UNSIGNED NOT NULL COMMENT '사용자 ID(users.id)',
                              role       ENUM('OWNER','EDITOR','VIEWER') NOT NULL DEFAULT 'VIEWER' COMMENT '권한/역할',
                              status     ENUM('ACTIVE','PENDING') NOT NULL DEFAULT 'ACTIVE' COMMENT '초대/참여 상태',
                              joined_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '참여(또는 초대) 시각',
                              PRIMARY KEY (plan_id, user_id),
                              KEY idx_plan_members_user (user_id),
                              KEY idx_plan_members_role (plan_id, role),
                              CONSTRAINT fk_plan_members_plan
                                  FOREIGN KEY (plan_id) REFERENCES plans(id)
                                      ON DELETE CASCADE
                                      ON UPDATE CASCADE,
                              CONSTRAINT fk_plan_members_user
                                  FOREIGN KEY (user_id) REFERENCES users(id)
                                      ON DELETE RESTRICT
                                      ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='플랜 참여자 및 권한(공동 편집)';

-- ---------------------------------------------------------
-- 4) plan_days: n일차 + 실제 날짜 (2박3일/3박4일 핵심 테이블)
-- ---------------------------------------------------------
CREATE TABLE plan_days (
                           id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '플랜 일자 PK',
                           plan_id     BIGINT UNSIGNED NOT NULL COMMENT '플랜 ID(plans.id)',
                           day_number  INT UNSIGNED    NOT NULL COMMENT 'n일차(1부터 시작)',
                           `date`      DATE            NOT NULL COMMENT '해당 일차의 실제 날짜(YYYY-MM-DD)',
                           created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
                           updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                           ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
                           PRIMARY KEY (id),
                           UNIQUE KEY uk_plan_days_plan_daynum (plan_id, day_number) COMMENT '플랜 내 n일차 중복 방지',
                           UNIQUE KEY uk_plan_days_plan_date (plan_id, `date`) COMMENT '플랜 내 같은 날짜 중복 방지',
                           KEY idx_plan_days_plan (plan_id),
                           KEY idx_plan_days_date (`date`),
                           CONSTRAINT fk_plan_days_plan
                               FOREIGN KEY (plan_id) REFERENCES plans(id)
                                   ON DELETE CASCADE
                                   ON UPDATE CASCADE,
                           CONSTRAINT chk_plan_days_daynum
                               CHECK (day_number >= 1)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='플랜의 일차(날짜/일차 번호)';

-- ---------------------------------------------------------
-- 5) places: 장소 마스터 (Mapbox/Kakao/Google 등 외부 소스 기반)
-- ---------------------------------------------------------
CREATE TABLE places (
                        id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '장소 PK(내부)',
                        source        VARCHAR(40)      NOT NULL COMMENT '장소 출처(mapbox/kakao/google/manual 등)',
                        source_place_id VARCHAR(128)   NOT NULL COMMENT '출처별 장소 ID(외부 ID)',
                        name          VARCHAR(200)     NOT NULL COMMENT '장소 이름',
                        address       VARCHAR(400)     NULL     COMMENT '주소(선택)',
                        latitude      DECIMAL(10,7)    NOT NULL COMMENT '위도',
                        longitude     DECIMAL(10,7)    NOT NULL COMMENT '경도',
                        category      VARCHAR(80)      NULL     COMMENT '카테고리(선택)',
                        created_at    DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
                        updated_at    DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                             ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
                        PRIMARY KEY (id),
                        UNIQUE KEY uk_places_source_ext (source, source_place_id) COMMENT '같은 출처+외부ID 중복 방지',
                        KEY idx_places_name (name),
                        KEY idx_places_latlng (latitude, longitude)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='장소 마스터(외부 지도 데이터 참조)';

-- ---------------------------------------------------------
-- 6) plan_items: 하루 안의 일정 아이템(순서/시간/메모)
-- ---------------------------------------------------------
CREATE TABLE plan_items (
                            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '일정 아이템 PK',
                            plan_day_id  BIGINT UNSIGNED NOT NULL COMMENT '플랜 일자 ID(plan_days.id)',
                            place_id     BIGINT UNSIGNED NOT NULL COMMENT '장소 ID(places.id)',
                            sort_order   INT UNSIGNED    NOT NULL COMMENT '해당 일자에서의 순서(1부터 권장)',
                            start_time   TIME            NULL     COMMENT '시작 시간(선택, 로컬 기준)',
                            end_time     TIME            NULL     COMMENT '종료 시간(선택, 로컬 기준)',
                            memo         VARCHAR(800)    NULL     COMMENT '메모(선택)',
                            created_by   BIGINT UNSIGNED NULL     COMMENT '생성자(users.id, 선택)',
                            created_at   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성 시각',
                            updated_at   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                           ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정 시각',
                            PRIMARY KEY (id),
                            UNIQUE KEY uk_plan_items_day_sort (plan_day_id, sort_order) COMMENT '하루 내 같은 순서 중복 방지',
                            KEY idx_plan_items_day (plan_day_id),
                            KEY idx_plan_items_place (place_id),
                            KEY idx_plan_items_creator (created_by),
                            CONSTRAINT fk_plan_items_day
                                FOREIGN KEY (plan_day_id) REFERENCES plan_days(id)
                                    ON DELETE CASCADE
                                    ON UPDATE CASCADE,
                            CONSTRAINT fk_plan_items_place
                                FOREIGN KEY (place_id) REFERENCES places(id)
                                    ON DELETE RESTRICT
                                    ON UPDATE CASCADE,
                            CONSTRAINT fk_plan_items_created_by
                                FOREIGN KEY (created_by) REFERENCES users(id)
                                    ON DELETE SET NULL
                                    ON UPDATE CASCADE,
                            CONSTRAINT chk_plan_items_sort
                                CHECK (sort_order >= 1),
                            CONSTRAINT chk_plan_items_time_range
                                CHECK (start_time IS NULL OR end_time IS NULL OR start_time <= end_time)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='플랜의 일자별 일정 아이템(장소/순서/시간/메모)';

-- ---------------------------------------------------------
-- (권장) owner는 plan_members에 OWNER로 자동 등록되게 애플리케이션에서 처리
-- 1) plans 생성
-- 2) plan_members에 (plan_id, owner_id, role='OWNER') insert
-- 3) plan_days는 start_date~end_date 기준으로 day_number 채워 insert
-- ---------------------------------------------------------
