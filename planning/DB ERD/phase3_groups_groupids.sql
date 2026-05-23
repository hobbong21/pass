-- =============================================================================
-- CHON-DID Phase 3 Migration: 그룹 & 신분증
-- Target: MariaDB 10.x
-- Sprint: 3
-- 전제 조건: Phase 2 완료 (relations, matrix 테이블 존재)
--
-- 변경 내용:
--   1) Groups 테이블 신설
--   2) GroupIDs 테이블 신설 (기존 card_info의 DID 필드 흡수)
--   3) GroupMembers 테이블 신설
--   4) 회사·학교 매트릭스 카테고리 활성화
--   5) 기존 card_info의 DID 데이터를 GroupIDs로 이관 (원본은 보존)
-- =============================================================================

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- 3.1 Groups 테이블 신설
-- -----------------------------------------------------------------------------
CREATE TABLE groups_room (
    group_id       CHAR(36)     NOT NULL COMMENT 'UUID',
    name           VARCHAR(100) NOT NULL,
    description    TEXT         NULL,
    type           VARCHAR(20)  NOT NULL COMMENT 'family | company | school | custom',
    category       VARCHAR(20)  NOT NULL COMMENT '대응 Matrix.category',
    owner_user_id  BIGINT       NOT NULL,
    member_count   INT          NOT NULL DEFAULT 1,
    max_members    INT          NOT NULL DEFAULT 100,
    visibility     VARCHAR(20)  NOT NULL DEFAULT 'private'
                                  COMMENT 'private | discoverable',
    avatar_url     VARCHAR(500) NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
    archived_at    DATETIME     NULL,
    PRIMARY KEY (group_id),
    INDEX idx_groups_owner (owner_user_id),
    INDEX idx_groups_type_category (type, category),
    CONSTRAINT fk_groups_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='상호 인증으로 형성된 그룹방';

-- 참고: 'groups'는 MySQL 예약어이므로 groups_room으로 명명.
-- 애플리케이션 계층에서는 'Group' 엔티티로 매핑.

-- -----------------------------------------------------------------------------
-- 3.2 GroupMembers 테이블 (그룹 - 사용자 N:M)
-- -----------------------------------------------------------------------------
CREATE TABLE group_members (
    member_id      CHAR(36)     NOT NULL COMMENT 'UUID',
    group_id       CHAR(36)     NOT NULL,
    user_id        BIGINT       NOT NULL,
    role           VARCHAR(20)  NOT NULL DEFAULT 'member'
                                  COMMENT 'owner | admin | member',
    joined_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at        DATETIME     NULL,
    invited_by     BIGINT       NULL,
    active         TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (member_id),
    UNIQUE KEY uk_group_user_active (group_id, user_id, active),
    INDEX idx_group_members_user (user_id, active),
    INDEX idx_group_members_role (group_id, role),
    CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES groups_room(group_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3.3 GroupIDs 테이블 (그룹 신분증 — DID + 서명 포함)
--     기존 card_info의 DID 필드를 흡수
-- -----------------------------------------------------------------------------
CREATE TABLE group_ids (
    gid_id          CHAR(36)      NOT NULL COMMENT 'UUID',
    group_id        CHAR(36)      NOT NULL,
    user_id         BIGINT        NOT NULL,
    role            VARCHAR(20)   NOT NULL,

    -- DID 관련 (기존 card_info 흡수)
    did             VARCHAR(255)  NULL  COMMENT 'did:chon:0x...',
    public_key      TEXT          NULL,
    signature       TEXT          NULL,
    block_height    BIGINT        NULL,
    tx_id           VARCHAR(255)  NULL,
    signed_at       DATETIME      NULL,

    -- 신분증 메타데이터
    matrix_snapshot JSON          NULL  COMMENT '발급 시점의 매트릭스 좌표 스냅샷',
    permissions     JSON          NULL  COMMENT '역할별 권한 (speak, manage, invite 등)',

    active          TINYINT(1)    NOT NULL DEFAULT 1,
    issued_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at      DATETIME      NULL,
    revoked_reason  VARCHAR(50)   NULL COMMENT 'user_left | relation_revoked | admin_action',

    PRIMARY KEY (gid_id),
    UNIQUE KEY uk_group_user_active (group_id, user_id, active),
    INDEX idx_group_ids_user (user_id, active),
    INDEX idx_group_ids_did (did),
    CONSTRAINT fk_group_ids_group FOREIGN KEY (group_id) REFERENCES groups_room(group_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_group_ids_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='그룹 신분증 (DID + 서명 + 권한)';

-- -----------------------------------------------------------------------------
-- 3.4 Matrix 카테고리 확장 — company, school 활성화
--     이미 ENUM 미사용으로 자유 입력 가능. 카테고리 메타 테이블 신설.
-- -----------------------------------------------------------------------------
CREATE TABLE matrix_categories (
    category       VARCHAR(20)  NOT NULL,
    display_name   VARCHAR(50)  NOT NULL,
    axis_x_label   VARCHAR(50)  NOT NULL,
    axis_y_label   VARCHAR(50)  NOT NULL,
    description    TEXT         NULL,
    enabled        TINYINT(1)   NOT NULL DEFAULT 1,
    sort_order     INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO matrix_categories (category, display_name, axis_x_label, axis_y_label, sort_order)
VALUES
    ('basic',   '기본형', '순서', '서열', 1),
    ('family',  '가계도', '순서(촌수)', '세대', 2),
    ('company', '회사',   '소속(부서)', '서열(직급)', 3),
    ('school',  '학교',   '소속(학과)', '서열(기수)', 4);

INSERT INTO schema_migrations (version, phase, description)
VALUES ('20260701_phase3_groups_groupids', 3,
        'Sprint 3: groups_room, group_members, group_ids, matrix_categories');

COMMIT;

-- =============================================================================
-- 데이터 마이그레이션 — 별도 트랜잭션
-- =============================================================================

START TRANSACTION;

-- -----------------------------------------------------------------------------
-- 3.5 기존 card_info → group_ids 이관 (원본 보존, additive 복사)
--     card_info 가정 스키마: id, user_id, did, signature, public_key,
--                            block_height, tx_id, created_at, status
-- -----------------------------------------------------------------------------
-- 가족 도메인의 기본 그룹을 자동 생성한 뒤 신분증 이관
INSERT INTO groups_room (group_id, name, type, category, owner_user_id, created_at)
SELECT
    UUID(),
    CONCAT('가족 그룹 - ', u.name),
    'family',
    'family',
    ci.user_id,
    MIN(ci.created_at)
FROM card_info ci
INNER JOIN users u ON u.id = ci.user_id
WHERE ci.did IS NOT NULL
  AND ci.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM groups_room g
      WHERE g.owner_user_id = ci.user_id AND g.type = 'family'
  )
GROUP BY ci.user_id, u.name;

-- 그룹 멤버 자동 추가 (owner)
INSERT INTO group_members (member_id, group_id, user_id, role)
SELECT UUID(), g.group_id, g.owner_user_id, 'owner'
FROM groups_room g
WHERE NOT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = g.group_id AND gm.user_id = g.owner_user_id
);

-- card_info의 DID 데이터를 group_ids로 이관
INSERT INTO group_ids (
    gid_id, group_id, user_id, role, did, public_key, signature,
    block_height, tx_id, signed_at, active
)
SELECT
    UUID(),
    g.group_id,
    ci.user_id,
    'owner',
    ci.did,
    ci.public_key,
    ci.signature,
    ci.block_height,
    ci.tx_id,
    ci.created_at,
    CASE WHEN ci.status = 'active' THEN 1 ELSE 0 END
FROM card_info ci
INNER JOIN groups_room g
    ON g.owner_user_id = ci.user_id AND g.type = 'family'
WHERE ci.did IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM group_ids gi
      WHERE gi.group_id = g.group_id AND gi.user_id = ci.user_id
  );

-- card_info에 마이그레이션 표시 (원본은 보존)
ALTER TABLE card_info
    ADD COLUMN IF NOT EXISTS migrated_to_gid CHAR(36) NULL
        COMMENT 'group_ids.gid_id 참조 — Phase 3 이관 추적용';

UPDATE card_info ci
INNER JOIN group_ids gi ON gi.user_id = ci.user_id AND gi.did = ci.did
SET ci.migrated_to_gid = gi.gid_id;

-- -----------------------------------------------------------------------------
-- 3.6 검증 쿼리
-- -----------------------------------------------------------------------------
SELECT 'groups_room' AS table_name, COUNT(*) AS total FROM groups_room
UNION ALL
SELECT 'group_members', COUNT(*) FROM group_members
UNION ALL
SELECT 'group_ids', COUNT(*) FROM group_ids
UNION ALL
SELECT 'card_info_migrated',
       SUM(CASE WHEN migrated_to_gid IS NOT NULL THEN 1 ELSE 0 END)
FROM card_info;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- START TRANSACTION;
-- ALTER TABLE card_info DROP COLUMN IF EXISTS migrated_to_gid;
-- DROP TABLE IF EXISTS group_ids;
-- DROP TABLE IF EXISTS group_members;
-- DROP TABLE IF EXISTS groups_room;
-- DROP TABLE IF EXISTS matrix_categories;
-- DELETE FROM schema_migrations WHERE version = '20260701_phase3_groups_groupids';
-- COMMIT;
-- =============================================================================
