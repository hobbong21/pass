-- =============================================================================
-- CHON-DID Phase 4 Migration: 고도화 및 정리
-- Target: MariaDB 10.x
-- Sprint: 4
-- 전제 조건: Phase 1~3 완료 및 마이그레이션 검증 완료
--
-- 변경 내용:
--   1) MatrixHistory 테이블 신설 (이력 추적)
--   2) Disputes 테이블 신설 (분쟁 조정)
--   3) DID 표준 호환 메타 테이블 신설
--   4) 기존 deprecate 컬럼/테이블 아카이브 (실제 삭제는 검토 후 별도 수행)
-- =============================================================================

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- 4.1 MatrixHistory 테이블 (이직, 졸업 등 매트릭스 전환 이력)
-- -----------------------------------------------------------------------------
CREATE TABLE matrix_history (
    history_id     CHAR(36)     NOT NULL,
    user_id        BIGINT       NOT NULL,
    matrix_id      CHAR(36)     NULL COMMENT '변경 대상 matrix 레코드',
    category       VARCHAR(20)  NOT NULL,
    old_axis_x     VARCHAR(100) NULL,
    old_axis_y     VARCHAR(100) NULL,
    new_axis_x     VARCHAR(100) NULL,
    new_axis_y     VARCHAR(100) NULL,
    transition_type VARCHAR(30) NOT NULL
                                  COMMENT 'job_change | graduation | promotion | manual',
    effective_date DATE         NOT NULL,
    triggered_renegotiations INT NOT NULL DEFAULT 0,
    reason         TEXT         NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by     BIGINT       NULL,
    PRIMARY KEY (history_id),
    INDEX idx_matrix_history_user_date (user_id, effective_date),
    INDEX idx_matrix_history_category (category),
    CONSTRAINT fk_matrix_history_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4.2 Disputes 테이블 (분쟁 조정)
-- -----------------------------------------------------------------------------
CREATE TABLE disputes (
    dispute_id     CHAR(36)     NOT NULL,
    rel_id         CHAR(36)     NOT NULL,
    reporter_id    BIGINT       NOT NULL,
    reported_id    BIGINT       NOT NULL,
    reason         TEXT         NOT NULL,
    evidence       JSON         NULL COMMENT '증빙 URL 배열',
    status         VARCHAR(20)  NOT NULL DEFAULT 'open'
                                  COMMENT 'open | reviewing | resolved | dismissed',
    resolution     VARCHAR(20)  NULL COMMENT 'upheld | dismissed | mediated',
    resolved_by    BIGINT       NULL COMMENT '관리자 user_id',
    resolved_at    DATETIME     NULL,
    notes          TEXT         NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (dispute_id),
    INDEX idx_disputes_status (status),
    INDEX idx_disputes_rel (rel_id),
    CONSTRAINT fk_disputes_relation FOREIGN KEY (rel_id) REFERENCES relations(rel_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_disputes_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_disputes_reported FOREIGN KEY (reported_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4.3 DID Document 캐시 (W3C 호환)
-- -----------------------------------------------------------------------------
CREATE TABLE did_documents (
    did            VARCHAR(255) NOT NULL,
    user_id        BIGINT       NOT NULL,
    document       JSON         NOT NULL COMMENT 'W3C DID Core 1.0 호환 문서',
    version        INT          NOT NULL DEFAULT 1,
    is_current     TINYINT(1)   NOT NULL DEFAULT 1,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deprecated_at  DATETIME     NULL,
    PRIMARY KEY (did, version),
    INDEX idx_did_documents_user (user_id, is_current),
    CONSTRAINT fk_did_documents_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4.4 이벤트 그룹 연결 (기존 event 테이블 확장)
-- -----------------------------------------------------------------------------
ALTER TABLE event
    ADD COLUMN IF NOT EXISTS group_id CHAR(36) NULL
        COMMENT 'Sprint 4: 그룹 단위 이벤트 지원',
    ADD INDEX IF NOT EXISTS idx_event_group (group_id);

INSERT INTO schema_migrations (version, phase, description)
VALUES ('20260801_phase4_advanced', 4,
        'Sprint 4: matrix_history, disputes, did_documents, event.group_id');

COMMIT;

-- =============================================================================
-- 4.5 Deprecate 컬럼/테이블 정리 — 별도 트랜잭션 (신중하게 실행)
-- =============================================================================
-- 주의: 아래 작업은 Phase 1~3 마이그레이션 검증을 충분히 완료한 후 실행.
--       최소 1~2주 운영 모니터링 후 진행 권장.
-- -----------------------------------------------------------------------------

-- 단계 1: 데이터가 모두 이관되었는지 최종 확인
SELECT
    'users without phone' AS check_name,
    COUNT(*) AS count
FROM users
WHERE phone IS NULL AND status = 'active'
UNION ALL
SELECT
    'card_info not migrated',
    COUNT(*)
FROM card_info
WHERE did IS NOT NULL AND migrated_to_gid IS NULL
UNION ALL
SELECT
    'clan_info not in matrix',
    COUNT(*)
FROM clan_info ci
WHERE NOT EXISTS (
    SELECT 1 FROM matrix m WHERE m.user_id = ci.user_id AND m.category = 'family'
);

-- 위 쿼리 결과가 모두 0인 것을 확인한 후 아래 진행

-- -----------------------------------------------------------------------------
-- 단계 2: deprecate 테이블 아카이브 (DROP 대신 RENAME으로 보존)
-- -----------------------------------------------------------------------------
-- START TRANSACTION;
--
-- -- 기존 테이블을 _archived_v1 접미사로 보존
-- RENAME TABLE card_info       TO card_info_archived_v1;
-- RENAME TABLE relation        TO relation_archived_v1;
-- RENAME TABLE relation_users  TO relation_users_archived_v1;
-- RENAME TABLE point_verify    TO point_verify_archived_v1;
-- RENAME TABLE verify_contact  TO verify_contact_archived_v1;
-- RENAME TABLE clan_info       TO clan_info_archived_v1;
--
-- -- users.password 컬럼 삭제 (Phase 1에서 nullable화 했음)
-- ALTER TABLE users DROP COLUMN password;
--
-- INSERT INTO schema_migrations (version, phase, description)
-- VALUES ('20260815_phase4_archive', 4,
--         'Sprint 4: Legacy 테이블 아카이브, users.password 삭제');
--
-- COMMIT;

-- -----------------------------------------------------------------------------
-- 단계 3: 최종 삭제 (단계 2 이후 1개월 이상 운영 모니터링 후 실행)
-- -----------------------------------------------------------------------------
-- START TRANSACTION;
-- DROP TABLE IF EXISTS card_info_archived_v1;
-- DROP TABLE IF EXISTS relation_archived_v1;
-- DROP TABLE IF EXISTS relation_users_archived_v1;
-- DROP TABLE IF EXISTS point_verify_archived_v1;
-- DROP TABLE IF EXISTS verify_contact_archived_v1;
-- DROP TABLE IF EXISTS clan_info_archived_v1;
-- COMMIT;

-- =============================================================================
-- ROLLBACK (Phase 4 신규 테이블만 대상)
-- =============================================================================
-- START TRANSACTION;
-- ALTER TABLE event DROP COLUMN IF EXISTS group_id;
-- DROP TABLE IF EXISTS did_documents;
-- DROP TABLE IF EXISTS disputes;
-- DROP TABLE IF EXISTS matrix_history;
-- DELETE FROM schema_migrations WHERE version = '20260801_phase4_advanced';
-- COMMIT;
-- =============================================================================
