# PASS 연동 실행 · 테스트 가이드

> 프론트엔드(HTML 프로토타입) ↔ NestJS 백엔드 연동을 로컬에서 실행하고 테스트하는 방법.
> 작성: 2026-05-23

---

## 개요 — 무엇이 연동되었나

```
frontend/auth/login.html ─┐
frontend/main/home.html  ─┼─▶ frontend/lib/pass-api.js ─▶ NestJS 백엔드 ─▶ SQLite(dev.db)
frontend/main/contact.html  ─┘     (API 클라이언트)                  :3000/api
```

`pass-api.js`가 인증·사용자·관계·포스트·채팅 전 API를 감싸며, HTML 화면들이 이를 통해
백엔드와 통신한다. 로그인 상태가 아니면 각 화면은 기존 데모 데이터로 동작한다(graceful fallback).

---

## 사전 준비

- **Node.js 18 이상** (개발 검증은 v20/v22 기준)
- 백엔드 기본 DB는 SQLite라 별도 DB 설치 불필요

---

## 1단계 — 백엔드 실행

```bash
cd backend
npm install
npm run prisma:generate      # Prisma 클라이언트 생성
npm run prisma:migrate       # 스키마 마이그레이션 (최초 1회)
npm run prisma:seed          # 데모 데이터 주입
npm run start                # → http://localhost:3000/api
```

`🚀 PASS Backend running on http://localhost:3000/api` 로그가 뜨면 정상.

> `.env`는 `npm install` 시 없으면 `.env.example`을 복사해 쓰면 된다 (`cp .env.example .env`).

---

## 2단계 — 자동 통합 점검 (권장)

백엔드가 떠 있는 상태에서 다른 터미널에서:

```bash
cd backend
node integration-check.cjs
```

가입 → 로그인 → 포스트/피드/좋아요/댓글 → 관계 요청·수락 → 채팅 → WebSocket
까지 **20개 항목**을 자동 점검한다. `20 통과 / 0 실패`가 나오면 연동이 정상이다.

---

## 3단계 — 화면에서 직접 테스트

브라우저에서 `frontend/auth/login.html`을 연다 (파일 더블클릭으로 열어도 됨 —
`pass-api.js`가 `file://`·`localhost`에서 자동으로 `http://localhost:3000/api`를 바라본다).

1. **로그인** — 이메일 `demo@chon.ai` 입력 → OTP 요청 → 코드 `123456` 입력 → 로그인
2. `frontend/main/home.html`(메인 허브)로 이동된다
3. 메인에서 **SNS(`frontend/main/contact.html`)** 진입
4. **피드 탭** — 시드된 포스트 4개가 보인다. 글 작성 / 좋아요 / 필터 전환을 하면
   백엔드에 반영된다 (새로고침해도 유지)
5. **채팅 탭** — 시드된 대화방 1개가 보인다. 열어서 메시지를 보내면 백엔드에 저장된다

### 2개 계정으로 상호 테스트

다른 브라우저(또는 시크릿 창)에서 새 계정을 가입(`회원가입` → 휴대폰 OTP `123456`)한 뒤,
한쪽에서 관계 요청·메시지를 보내고 다른 쪽에서 수신을 확인하면 양방향 연동을 검증할 수 있다.

---

## 데모 계정 (시드 데이터)

| 이메일 | 이름 | 로그인 |
|--------|------|--------|
| `demo@chon.ai` | 홍길순 | 이메일 OTP `123456` |
| `kim@chon.ai` | 김민수 | 이메일 OTP `123456` |
| `park@chon.ai` | 박지영 | 이메일 OTP `123456` |
| `lee@chon.ai` | 이상호 | 이메일 OTP `123456` |
| `choi@chon.ai` | 최서연 | 이메일 OTP `123456` |

데모 계정은 서로 모임원(친구) 관계가 맺어져 있고, `demo@chon.ai` 기준 포스트 4개 +
대화방 1개가 시드되어 있다.

> OTP 코드는 개발 모드에서 `123456` 고정(`.env`의 `OTP_DEMO_CODE`).
> 시드된 PIN `789012`는 디바이스 ID `demo-device` 전용이라 브라우저(랜덤 디바이스 ID)에서는
> PIN 로그인 대신 **이메일 OTP 로그인**을 사용한다.

---

## 연동 범위

### 연동 완료

- `frontend/auth/login.html` — 가입 / 이메일 OTP 로그인 / PIN
- `frontend/main/home.html` — 토큰 확인 · 본인 정보 조회
- `frontend/main/contact.html` — **피드**(목록·작성·좋아요·댓글 수) + **채팅**(대화방·메시지·전송)
- `frontend/lib/pass-api.js` — 인증·사용자·관계·포스트·채팅 전 계층 (백엔드와 계약 검증 완료)
- 백엔드 6개 모듈 (Auth · Users · Contacts · Relations · Posts · Chat)

### 아직 데모 데이터로 동작 (연동 보류)

- `frontend/main/contact.html`의 **관계 네트워크 뷰**(가계도 / 그래프 / 리스트), Trust Garden, 뱃지
- 독립 시각화 도구 `frontend/views/family-tree.html` · `frontend/views/class-id.html` · `frontend/views/friends.html`

> 이 도구들은 "CHON 미가입 가족·구성원"을 노드로 추가하는데, 백엔드 `relations`는
> 가입 사용자(`toUserId`)만 관계 대상으로 받는다. 미가입 멤버를 어떻게 다룰지
> (placeholder 노드 허용 / 가입 사용자만 / 스키마 확장)는 설계 결정이 필요해 보류했다.

---

## 알려진 제약 / 참고

- **실시간 채팅(WebSocket)**: 백엔드 게이트웨이와 `pass-api.js`의 `connectChat()`은 동작하지만
  `frontend/main/contact.html`에는 REST 방식만 연결돼 있다. 상대 메시지는 대화방 재진입 시 갱신된다.
- 비로그인 상태로 `frontend/main/contact.html`을 직접 열면 기존 데모 데이터로 동작한다.
- `package.json`의 NestJS 패키지 버전이 코어(v10)와 어긋나 있어(websockets/socket.io v11)
  v10으로 정렬했다 — 이 수정이 없으면 `npm install`이 실패한다.

---

## 검증 결과 (2026-05-23)

- 백엔드 e2e 테스트: **27/27 통과** (auth 11, flow 16)
- `pass-api.js` ↔ 백엔드 통합 점검: **20/20 통과**
- 연동 코드(피드·채팅) 구문 검증 통과

화면 동작(브라우저 렌더링)은 위 3단계 절차로 직접 확인하면 된다.
