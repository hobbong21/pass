-- =============================================================================
-- CHON-DID Phase 1 Migration: 인증 인프라
-- Target: MariaDB 10.x (기존 chondb)
-- Sprint: 1
-- 작성일: 2026-05
--
-- 변경 내용:
--   1) Users 테이블 신설 (기존 users 확장 방식, additive)
--   2) AuthCodes 테이블 신설
--   3) Contacts 동기화 보조 테이블 신설
--   4) 기존 users 테이블에 phone, status 컬럼 추가
--
-- 원칙:
--   - 모든 변경은 additive. 기존 컬럼/테이블 삭제 없음.
--   - 백필 후에도 원본 데이터 유지.
--   - 실패 시 즉시 ROLLBACK 가능하도록 트랜잭션 단위로 구성.
-- =============================================================================

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- 1.1 기존 users 테이블에 컬럼 추가 (NULL 허용으로 시작 → 백필 → NOT NULL 전환)
-- -----------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN phone           VARCHAR(20)  NULL COMMENT 'E.164 format phone number',
    ADD COLUMN phone_verified  TINYINT(1)   NOT NULL DEFAULT 0,
    ADD COLUMN status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                              COMMENT 'active | suspended | deleted',
    ADD COLUMN last_login_at   DATETIME     NULL,
    ADD COLUMN device_id       VARCHAR(128) NULL COMMENT '자동 로그인용';

CREATE INDEX idx_users_phone        ON users(phone);
CREATE INDEX idx_users_status       ON users(status);
CREATE INDEX idx_users_device_id    ON users(device_id);

-- -----------------------------------------------------------------------------
-- 1.2 password 컬럼은 nullable 처리 (deprecate 1단계)
--     실제 삭제는 Phase 4에서 진행
-- -----------------------------------------------------------------------------
ALTER TABLE users
    MODIFY COLUMN password VARCHAR(255) NULL COMMENT 'DEPRECATED — Phase 4에서 삭제 예정';

-- -----------------------------------------------------------------------------
-- 1.3 AuthCodes 테이블 신설
-- -----------------------------------------------------------------------------
CREATE TABLE auth_codes (
    code_id        CHAR(36)     NOT NULL COMMENT 'UUID',
    phone          VARCHAR(20)  NOT NULL,
    code           CHAR(6)      NOT NULL COMMENT '6자리 숫자',
    purpose        VARCHAR(20)  NOT NULL DEFAULT 'login'
                                 COMMENT 'login | register | phone_change',
    attempts       INT          NOT NULL DEFAULT 0,
    max_attempts   INT          NOT NULL DEFAULT 5,
    expires_at     DATETIME     NOT NULL,
    consumed_at    DATETIME     NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address     VARCHAR(45)  NULL,
    user_agent     VARCHAR(255) NULL,
    PRIMARY KEY (code_id),
    INDEX idx_auth_codes_phone_expires (phone, expires_at),
    INDEX idx_auth_codes_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SMS 인증 코드 발급·만료 관리';

-- -----------------------------------------------------------------------------
-- 1.4 Refresh Tokens 테이블 신설 (JWT 리프레시 토큰 관리)
-- -----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    token_id       CHAR(36)     NOT NULL COMMENT 'UUID',
    user_id        BIGINT       NOT NULL,
    token_hash     VARCHAR(128) NOT NULL COMMENT 'SHA-256 hash, 평문 토큰 저장 금지',
    device_id      VARCHAR(128) NULL,
    expires_at     DATETIME     NOT NULL,
    revoked_at     DATETIME     NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at   DATETIME     NULL,
    PRIMARY KEY (token_id),
    UNIQUE KEY uk_token_hash (token_hash),
    INDEX idx_refresh_tokens_user (user_id, revoked_at),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 1.5 Contacts 동기화 보조 테이블 (해시 기반 매칭용)
-- -----------------------------------------------------------------------------
CREATE TABLE contact_links (
    link_id        CHAR(36)     NOT NULL COMMENT 'UUID',
    owner_user_id  BIGINT       NOT NULL COMMENT '연락처를 동기화한 사용자',
    target_user_id BIGINT       NULL     COMMENT '매칭된 가입자 (NULL이면 미가입)',
    hashed_phone   CHAR(64)     NOT NULL COMMENT 'SHA-256(E.164 phone)',
    target_phone   VARCHAR(20)  NULL     COMMENT '미가입자 대상 초대용 (해시 미가입 시에만)',
    invited_at     DATETIME     NULL,
    invite_channel VARCHAR(20)  NULL     COMMENT 'sms | kakao',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (link_id),
    UNIQUE KEY uk_owner_hashed_phone (owner_user_id, hashed_phone),
    INDEX idx_contact_links_target (target_user_id),
    CONSTRAINT fk_contact_links_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='연락처 동기화 — 해시 비교, 평문 전화번호 미저장 원칙';

-- -----------------------------------------------------------------------------
-- 1.6 마이그레이션 이력 테이블 (모든 Phase 공통)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    version        VARCHAR(50)  NOT NULL,
    phase          INT          NOT NULL,
    applied_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by     VARCHAR(100) NULL,
    description    TEXT         NULL,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version, phase, description)
VALUES ('20260601_phase1_auth', 1, 'Sprint 1: 인증 인프라 — Users 확장, AuthCodes, RefreshTokens, ContactLinks');

COMMIT;

-- =============================================================================
-- 백필 (Backfill) 스크립트 — 별도 트랜잭션
-- =============================================================================
-- 기존 사용자의 phone 컬럼을 verify_contact 테이블에서 백필
-- (verify_contact 테이블은 기존 시스템의 검증된 연락처 보관소)
-- -----------------------------------------------------------------------------

START TRANSACTION;

UPDATE users u
INNER JOIN verify_contact vc ON vc.user_id = u.id
SET u.phone = vc.phone,
    u.phone_verified = 1
WHERE u.phone IS NULL
  AND vc.phone IS NOT NULL
  AND vc.status = 'verified';

-- 백필 결과 검증 (실행 후 확인 필수)
SELECT
    COUNT(*) AS total_users,
    SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) AS users_with_phone,
    SUM(CASE WHEN phone_verified = 1 THEN 1 ELSE 0 END) AS verified_users
FROM users;

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (필요 시 별도 파일로 실행)
-- =============================================================================
-- 주의: ROLLBACK은 데이터 손실 위험이 있으므로 매우 신중하게 사용
--
-- START TRANSACTION;
--
-- DROP TABLE IF EXISTS contact_links;
-- DROP TABLE IF EXISTS refresh_tokens;
-- DROP TABLE IF EXISTS auth_codes;
--
-- ALTER TABLE users
--     DROP COLUMN device_id,
--     DROP COLUMN last_login_at,
--     DROP COLUMN status,
--     DROP COLUMN phone_verified,
--     DROP COLUMN phone;
--
-- ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL;
--
-- DELETE FROM schema_migrations WHERE version = '20260601_phase1_auth';
--
-- COMMIT;
-- =============================================================================
