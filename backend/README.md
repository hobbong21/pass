# PASS Backend

NestJS · Prisma · SQLite (개발) / MariaDB (프로덕션) — P0~P4 통합 백엔드.

## 📦 Sprint 범위

| 우선 | 모듈 | 매칭 프론트 |
|---|---|---|
| **P0** | Auth (가입 / OTP / 이메일 OTP 로그인 / PIN 2FA / JWT / Refresh) | frontend/auth/login.html |
| **P1** | Users · Contacts (해시 기반 연락처 동기화) | 프로필, 모임 |
| **P2** | Relations (가족 tier · 모임 1·2-hop · 학급 role) | 가계도·모임·학급증 |
| **P3** | Posts/Feed (작성·피드·좋아요·댓글) | frontend/main/contact.html |
| **P4** | Chat (1:1 대화방·메시지·읽음) | frontend/main/contact.html |

## 🚀 Quick Start

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수
cp .env.example .env
# (필요 시 secrets 수정)

# 3) Prisma — DB 생성 + 마이그레이션 + 시드
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed

# 4) 개발 서버
npm run start:dev
# → http://localhost:3000/api
```

## 🧪 데모 계정

- 이메일: `demo@chon.ai`
- 전화번호: `010-1234-5678` (E.164: `+821012345678`)
- 디바이스 ID: `demo-device`
- PIN (2FA): `789012`
- OTP (모든 OTP 요청): `123456` (env `OTP_DEMO_CODE`)

> Production에서는 OTP가 응답에 반환되지 않고 SMS/메일 발송. `NODE_ENV=production`으로 토글.

## 📡 주요 엔드포인트

### Auth
| Method | Path | 설명 |
|---|---|---|
| POST | `/api/auth/otp/request` | OTP 발급 (channel: email/sms) |
| POST | `/api/auth/otp/verify` | OTP 검증 (consumed 처리) |
| POST | `/api/auth/signup` | 가입 (이메일+전화+휴대폰 OTP) |
| POST | `/api/auth/login/email-otp` | 이메일 OTP 로그인 (1FA) |
| POST | `/api/auth/login/pin` | PIN 로그인 (2FA·디바이스 기억) |
| POST | `/api/auth/pin/setup` | 디바이스 PIN 설정 (JWT 필요) |
| POST | `/api/auth/refresh` | 토큰 회전 |
| POST | `/api/auth/logout` | 로그아웃 (JWT 필요) |
| GET  | `/api/auth/me` | JWT payload 확인 |

### Users · Contacts
| Method | Path | 설명 |
|---|---|---|
| GET   | `/api/users/me` | 본인 프로필 |
| PATCH | `/api/users/me` | 프로필 수정 |
| DELETE| `/api/users/me` | 계정 비활성화 |
| POST  | `/api/contacts/sync` | 연락처 동기화 (해시 매칭) |
| GET   | `/api/contacts` | 동기화된 연락처 목록 |

### Relations
| Method | Path | 설명 |
|---|---|---|
| POST  | `/api/relations` | 관계 요청 (kind: family/friend/class) |
| PATCH | `/api/relations/:id/respond` | confirm / reject |
| PATCH | `/api/relations/:id/revoke` | 관계 폐기 |
| GET   | `/api/relations/me` | 내 관계 목록 (filter: kind, status) |
| GET   | `/api/relations/incoming` | 수신함 (PENDING) |
| GET   | `/api/relations/friends-of-friends` | 2-hop |
| GET   | `/api/relations/family-tree` | 가족 tier 그룹 |
| GET   | `/api/relations/class-roster` | 학급 role 그룹 |

### Posts
| Method | Path | 설명 |
|---|---|---|
| POST   | `/api/posts` | 작성 |
| GET    | `/api/posts/feed?filter=all\|friends\|extended\|self` | 피드 |
| GET    | `/api/posts/:id` | 단건 |
| PATCH  | `/api/posts/:id` | 수정 |
| DELETE | `/api/posts/:id` | 삭제 |
| POST   | `/api/posts/:id/like` | 좋아요 토글 |
| GET    | `/api/posts/:id/comments` | 댓글 목록 |
| POST   | `/api/posts/:id/comments` | 댓글 작성 |

### Chat
| Method | Path | 설명 |
|---|---|---|
| GET    | `/api/chat/conversations` | 대화방 목록 (안 읽음 수 포함) |
| POST   | `/api/chat/conversations/open` | 1:1 대화방 열기 (없으면 생성) |
| GET    | `/api/chat/conversations/:id/messages` | 메시지 목록 |
| POST   | `/api/chat/conversations/:id/messages` | 전송 |
| POST   | `/api/chat/conversations/:id/read` | 읽음 처리 |

## 🔐 보안 모델

- **OTP**: 코드 평문 미저장 (`sha256(code)`만), 5회 시도 잠금, 30초 재발급 쿨다운, 180초 TTL
- **PIN (2FA)**: 디바이스별 bcrypt 해시, 5회 실패 시 10분 잠금, 사소한 패턴 차단 (111111, 123456 등)
- **JWT**: Access 15분 / Refresh 14일, refresh는 sha256 해시 저장 + 1회용 회전 + 디바이스 결속
- **연락처**: 평문 전화번호 미저장, sha256(E.164) 해시만 보관
- **CORS**: env `CORS_ORIGIN` 으로 제어

## 🗄 DB 스키마

`prisma/schema.prisma` 참조. SQLite로 시작 → 운영 시 `datasource` 한 줄만 MariaDB로 교체 가능.

주요 테이블:
- `users` — 이메일+전화 가입
- `auth_codes` — OTP 발급/검증 이력
- `refresh_tokens` — 디바이스 결속 + 회전
- `device_pins` — 디바이스별 PIN (2FA)
- `contact_links` — 연락처 해시 매칭
- `relations` — 통합 관계 (kind/subtype/meta)
- `posts`, `post_likes`, `post_comments`
- `conversations`, `messages`, `message_reads`

## 🔄 프론트 연동

기존 PASS 프론트 (`../frontend/`)는 sessionStorage·localStorage로만 동작하는 데모.
이 백엔드와 연결하려면:
1. `../frontend/auth/login.html`의 `doLogin`, `confirmSignup`, `verifyCode` 등을 fetch로 교체
2. `Authorization: Bearer <accessToken>` 헤더 추가
3. 응답의 `refreshToken`을 localStorage 또는 secure cookie 보관

다음 작업으로 진행할 항목:
- 프론트 ↔ 백엔드 fetch 어댑터 추가
- WebSocket으로 실시간 채팅 업그레이드 (현재는 polling 가능)
- MariaDB 전환 + Docker compose
