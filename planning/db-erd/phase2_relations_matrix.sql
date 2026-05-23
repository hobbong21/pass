-- =============================================================================
-- CHON-DID Phase 2 Migration: 쌍방 인증 (Relations & Matrix)
-- Target: MariaDB 10.x
-- Sprint: 2
-- 전제 조건: Phase 1 완료 (users.phone, users.status 컬럼 존재)
--
-- 변경 내용:
--   1) Relations 테이블 신설 (기존 relation, relation_users 통합)
--   2) Matrix 테이블 신설 (기존 clan_info, family_tree 데이터 흡수)
--   3) 기존 relation 데이터 마이그레이션 (additive 방식)
--   4) 기존 clan_info → Matrix(family) 이관
-- =============================================================================

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- 2.1 Relations 테이블 신설
--     기존 relation + relation_users + point_verify 를 통합
-- -----------------------------------------------------------------------------
CREATE TABLE relations (
    rel_id              CHAR(36)     NOT NULL COMMENT 'UUID',
    from_user_id        BIGINT       NOT NULL,
    to_user_id          BIGINT       NOT NULL,
    category            VARCHAR(20)  NOT NULL DEFAULT 'basic'
                                       COMMENT 'basic | family | company | school',
    type                VARCHAR(50)  NOT NULL COMMENT '예: family.parent, company.manager',
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                                       COMMENT 'pending | renegotiating | confirmed | rejected | expired',
    matrix_axis_x       VARCHAR(100) NULL,
    matrix_axis_y       VARCHAR(100) NULL,
    matrix_metadata     JSON         NULL,
    renegotiation_count INT          NOT NULL DEFAULT 0,
    max_renegotiations  INT          NOT NULL DEFAULT 3,
    verify_point        INT          NOT NULL DEFAULT 0,
    max_verify_point    INT          NOT NULL DEFAULT 100,
    confirmed_at        DATETIME     NULL,
    expires_at          DATETIME     NULL COMMENT 'pending 30일 자동 만료',
    last_action_by      BIGINT       NULL COMMENT '마지막 행동 주체 (from/to)',
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (rel_id),
    UNIQUE KEY uk_relations_pair_category (from_user_id, to_user_id, category),
    INDEX idx_relations_to_status (to_user_id, status),
    INDEX idx_relations_from_status (from_user_id, status),
    INDEX idx_relations_category (category),
    INDEX idx_relations_expires (expires_at, status),
    CONSTRAINT fk_relations_from FOREIGN KEY (from_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_relations_to FOREIGN KEY (to_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_relations_diff_users CHECK (from_user_id <> to_user_id),
    CONSTRAINT chk_relations_renegotiation CHECK (renegotiation_count <= max_renegotiations)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='쌍방 인증된 관계 — relation, relation_users, point_verify 통합';

-- -----------------------------------------------------------------------------
-- 2.2 Matrix 테이블 신설
-- -----------------------------------------------------------------------------
CREATE TABLE matrix (
    matrix_id      CHAR(36)     NOT NULL COMMENT 'UUID',
    user_id        BIGINT       NOT NULL,
    category       VARCHAR(20)  NOT NULL COMMENT 'basic | family | company | school',
    axis_x         VARCHAR(100) NULL COMMENT '카테고리별 X축 (순서/부서/학과)',
    axis_y         VARCHAR(100) NULL COMMENT '카테고리별 Y축 (세대/직급/기수)',
    rank_label     VARCHAR(100) NULL COMMENT '사용자 친화적 라벨 (예: "본인", "큰형")',
    metadata       JSON         NULL,
    is_primary     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '카테고리 내 주 좌표 여부',
    valid_from     DATE         NOT NULL DEFAULT (CURRENT_DATE),
    valid_until    DATE         NULL COMMENT 'NULL이면 현재 유효',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (matrix_id),
    INDEX idx_matrix_user_category (user_id, category, valid_until),
    INDEX idx_matrix_coordinates (category, axis_x, axis_y),
    CONSTRAINT fk_matrix_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='도메인별 사용자 매트릭스 좌표';

-- -----------------------------------------------------------------------------
-- 2.3 Renegotiation 이력 테이블 (감사용)
-- -----------------------------------------------------------------------------
CREATE TABLE relation_renegotiations (
    nego_id        CHAR(36)     NOT NULL,
    rel_id         CHAR(36)     NOT NULL,
    attempt_no     INT          NOT NULL COMMENT '1, 2, 3',
    proposed_by    BIGINT       NOT NULL,
    old_axis_x     VARCHAR(100) NULL,
    old_axis_y     VARCHAR(100) NULL,
    new_axis_x     VARCHAR(100) NULL,
    new_axis_y     VARCHAR(100) NULL,
    reason         VARCHAR(500) NULL,
    resolution     VARCHAR(20)  NULL COMMENT 'accepted | counter_proposed | rejected',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at    DATETIME     NULL,
    PRIMARY KEY (nego_id),
    INDEX idx_renegotiations_rel (rel_id, attempt_no),
    CONSTRAINT fk_renegotiations_rel FOREIGN KEY (rel_id) REFERENCES relations(rel_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='재조정 이력';

INSERT INTO schema_migrations (version, phase, description)
VALUES ('20260615_phase2_relations_matrix', 2,
        'Sprint 2: Relations, Matrix, RelationRenegotiations 테이블 신설');

COMMIT;

-- =============================================================================
-- 데이터 마이그레이션 — 별도 트랜잭션
-- =============================================================================

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- 2.4 기존 relation 테이블 → relations 이관
--     기존 'relation' 테이블 스키마 가정: id, from_user, to_user, type, created_at
-- -----------------------------------------------------------------------------
INSERT INTO relations (
    rel_id, from_user_id, to_user_id, category, type, status, created_at
)
SELECT
    UUID(),
    r.from_user,
    r.to_user,
    'family' AS category,
    COALESCE(r.type, 'family.unknown') AS type,
    CASE
        WHEN ru.status = 'confirmed' THEN 'confirmed'
        WHEN ru.status = 'rejected'  THEN 'rejected'
        ELSE 'pending'
    END AS status,
    r.created_at
FROM relation r
LEFT JOIN relation_users ru
    ON ru.relation_id = r.id
WHERE NOT EXISTS (
    SELECT 1 FROM relations rn
    WHERE rn.from_user_id = r.from_user
      AND rn.to_user_id = r.to_user
      AND rn.category = 'family'
);

-- -----------------------------------------------------------------------------
-- 2.5 기존 point_verify → relations.verify_point 백필
-- -----------------------------------------------------------------------------
UPDATE relations rn
INNER JOIN relation r
    ON r.from_user = rn.from_user_id AND r.to_user = rn.to_user_id
INNER JOIN point_verify pv
    ON pv.relation_id = r.id
SET rn.verify_point = COALESCE(pv.point, 0)
WHERE rn.category = 'family';

-- -----------------------------------------------------------------------------
-- 2.6 기존 clan_info → Matrix(category='family') 이관
--     clan_info 스키마 가정: id, user_id, clan_name, generation, order_num
-- -----------------------------------------------------------------------------
INSERT INTO matrix (
    matrix_id, user_id, category, axis_x, axis_y, rank_label, metadata, is_primary
)
SELECT
    UUID(),
    ci.user_id,
    'family',
    CAST(ci.order_num AS CHAR) AS axis_x,
    CAST(ci.generation AS CHAR) AS axis_y,
    CONCAT(ci.clan_name, ' ', ci.generation, '세대 ', ci.order_num, '번째') AS rank_label,
    JSON_OBJECT('clan_name', ci.clan_name, 'source', 'clan_info_migration') AS metadata,
    1 AS is_primary
FROM clan_info ci
WHERE NOT EXISTS (
    SELECT 1 FROM matrix m
    WHERE m.user_id = ci.user_id AND m.category = 'family'
);

-- -----------------------------------------------------------------------------
-- 2.7 검증 쿼리 (수동 확인)
-- -----------------------------------------------------------------------------
SELECT
    'relations' AS table_name,
    COUNT(*) AS total,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
    SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending
FROM relations
UNION ALL
SELECT
    'matrix',
    COUNT(*),
    SUM(CASE WHEN category = 'family' THEN 1 ELSE 0 END),
    NULL
FROM matrix;

COMMIT;

-- =============================================================================
-- ROLLBACK (긴급 시)
-- =============================================================================
-- START TRANSACTION;
-- DROP TABLE IF EXISTS relation_renegotiations;
-- DROP TABLE IF EXISTS matrix;
-- DROP TABLE IF EXISTS relations;
-- DELETE FROM schema_migrations WHERE version = '20260615_phase2_relations_matrix';
-- COMMIT;
-- =============================================================================
