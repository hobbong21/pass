# CHON 기술 명세서 (TECH.md) v7

> **버전**: v7 (PDF 출시 코드 기준 재정리)
> **상태**: dev / stg 브랜치 반영
> **날짜**: 2026년 5월
> **변경 범위**: 시스템·아키텍처·보안만 변경. UX/UI는 별도 문서 (DESIGN.md) 참조.

---

## 1. 시스템 개요

CHON은 **하드웨어 결속 암호 서명** 기반의 보이스피싱 방어 시스템입니다. SIM-swap, 번호 스푸핑, Caller-ID 주입 같은 전화번호 기반 공격을 무력화하기 위해 **번호가 아닌 칩(Secure Enclave / StrongBox)을 신뢰**합니다.

### 1.1 핵심 원칙

> **CHON은 번호를 신뢰하지 않습니다. CHON은 하드웨어를 신뢰합니다.**

### 1.2 4가지 결속

서명은 동시에 다음 네 가지에 결속됩니다:

1. **비밀번호** — 사용자의 메인 백엔드 자격
2. **하드웨어 키** — App Attest / StrongBox
3. **상호 확인** — 두 명의 실제 CHON 사용자 간 페어링
4. **TRUSTED 상태** — 서명 시점의 단말 신뢰 상태

---

## 2. 아키텍처 (4-Component)

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Mobile App     │  │  Main Backend    │  │     VP API       │  │   FCM + APNs     │
│ iOS/Android      │  │ Spring Boot 3.2  │  │     NestJS       │  │   (Push)         │
│ Flutter          │  │ MariaDB          │  │ RDS MariaDB      │  │                  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │                     │
         └─────────────────────┴─────────────────────┴─────────────────────┘
                                        │
                          HTTPS over AWS ALB (ap-northeast-2)
                          TLS 1.2+ · 서비스 간 상호 JWT 검증
```

### 2.1 Mobile App

**플랫폼**: Flutter (iOS / Android) — 단일 코드베이스

**주요 책임**:
- UI 및 내비게이션 (Flutter)
- 하드웨어 보관 키 (Secure Enclave / StrongBox) — 네이티브
- 네이티브 통화 라벨링 (CallKit / CallScreening) — 네이티브 채널
- 음성 TTS 안내 (Android, Google TTS, 온디바이스)
- Android 전체 화면 오버레이 UI
- iOS Live Activity (Pro 모델)
- PRECALL 발행 (Android, `CallRedirectionService`)
- 수신자 상태 머신 (VERIFIED/UNKNOWN/SIM-SWAP)

### 2.2 Main Backend

**스택**: Spring Boot 3.2 · MariaDB (`chondb`, 벤더 호스팅)

**주요 책임**:
- 인증 및 사용자 관리
- **HS512 JWT 발급** (Secrets Manager 키)
- Refresh 토큰 (`deviceId` 결속)
- Call-Shield 연락처 동기화
- 가족 트리 (`relation_users`)
- Naver SENS OTP
- 새 기기 알림 (이메일 + 푸시)
- 감사 로그 (`auth_events`)

### 2.3 VP API

**스택**: NestJS · RDS MariaDB (`chon_dev` / `chon_stg`, 저장 시 AES 암호화)

**주요 책임**:
- **상호인증 게이트** (페어링)
- **기기 인증** (App Attest / Play Integrity)
- 공개키 검증 (ECDSA P-256)
- **PRECALL 서명 게이트**
- **LIVENESS 팬아웃**
- 신뢰 상태 머신 (TRUSTED / PENDING / REVOKED)
- 속도 제한 (다축)
- 감사 로그 (`vp_audit_log`)

### 2.4 FCM + APNs (Push)

**주요 책임**:
- APNs 푸시 (iOS)
- FCM 푸시 (Android)
- 사일런트 데이터 푸시 (PRECALL, LIVENESS, VERIFY_REQUEST)
- Display 푸시 (40초 부재중 알림, 인증 결과)
- 고우선 전송
- **벨 시점 신선도 보장** (PRECALL은 셀룰러 벨 3초 전 도착)

### 2.5 인증 경계

- **Main Backend** ←(JWT 발급)→ Mobile
- **VP API** ←(동일 Secrets Manager 키로 JWT 검증)→ Mobile
- VP API는 **첫 요청 시 JWT claim으로부터 자체 `users` 테이블 레코드 자동 생성**
- **두 서비스는 데이터베이스 미공유** — 신원만 공유

JWT claim:
- `sub` — 사용자 ID
- `uname` — 사용자명
- `phone` — 전화번호

---

## 3. 데이터 모델 (출시 코드 기준)

### 3.1 폰 — 보안 저장소

| 저장소 | 키/테이블 | 주요 필드 | 용도 |
|--------|---------|---------|------|
| Keychain / Keystore | `kLoginModel` | `accessToken`, `refreshToken`, `userName`, `phone` | 세션 부트스트랩 |
| Secure Element | App Attest 키 / StrongBox 키 | 비공개 키 (외부 미반출) + `keyId` | 실제 단말 증명 |
| EncryptedSharedPrefs (Android) /<br>AppGroup UserDefaults (iOS) | `precall_cache` | `{ callerPhone: expiresAtMs }` | 통화별 신선도 |
| 동일 | `liveness_cache` | `{ callerPhone: expiresAtMs }` | 대비책 활성도 |
| 동일 | `voice_announce_*` | `enabled`, `public_mode` | TTS 환경설정 |

### 3.2 Main Backend — `chondb`

**users** — 사용자 신원
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  hashed_password VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**refresh_tokens** — 세션 + 단말 잠금
```sql
CREATE TABLE refresh_tokens (
  user_id BIGINT,
  token_jti VARCHAR(64),
  family_id VARCHAR(64),
  device_id VARCHAR(128),
  expires_at TIMESTAMP,
  PRIMARY KEY (token_jti)
);
```

**relation_users** — 가족 트리
```sql
CREATE TABLE relation_users (
  cert_owner_id BIGINT,
  cert_related_id BIGINT,
  cert_related_phone VARCHAR(20),
  PRIMARY KEY (cert_owner_id, cert_related_id)
);
```

**auth_events** — 감사 + 새 단말 트리거
```sql
CREATE TABLE auth_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  event VARCHAR(64),
  ip VARCHAR(45),
  ua TEXT,
  ts TIMESTAMP
);
```

### 3.3 VP API — `chon_dev` / `chon_stg`

**vp_device_token** — 푸시 대상
```sql
CREATE TABLE vp_device_token (
  user_id BIGINT,
  platform ENUM('ios', 'android'),
  fcm_token TEXT,
  device_id VARCHAR(128)
);
```

**vp_device_attestation** — 하드웨어 결속 단말 증명 ⭐
```sql
CREATE TABLE vp_device_attestation (
  user_id BIGINT,
  key_id VARCHAR(128) PRIMARY KEY,
  public_key TEXT,             -- ECDSA P-256
  platform ENUM('ios', 'android'),
  last_heartbeat_at TIMESTAMP,
  trust_state ENUM('TRUSTED', 'PENDING', 'REVOKED')
);
```

**vp_verification** — 페어링 (상호인증)
```sql
CREATE TABLE vp_verification (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  requester_id BIGINT,
  target_phone VARCHAR(20),
  target_user_id BIGINT,
  status ENUM('PENDING', 'CONFIRMED', 'REVOKED', 'EXPIRED'),
  expires_at TIMESTAMP        -- PENDING은 5분 TTL
);
```

**vp_audit_log** — 행위 기록
```sql
CREATE TABLE vp_audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  verification_id BIGINT,
  action VARCHAR(64),
  actor_user_id BIGINT,
  ts TIMESTAMP
);
```

**vp_org_directory** — 알려진 사업자 번호
```sql
CREATE TABLE vp_org_directory (
  phone VARCHAR(20) PRIMARY KEY,
  org_name VARCHAR(255),
  org_type VARCHAR(64)
);
```

---

## 4. 신뢰 체인 (Trust Chain)

### 4.1 단일 신뢰 근원

```
사용자의 물리적 단말
        ↓
Apple Secure Enclave / StrongBox
        ↓
   비공개 키
   (칩을 절대 떠나지 않음)
        ↓
   ECDSA P-256 서명
        ↓
서버: 공개 키 + trust_state만 보관
```

### 4.2 trust_state 전이

```
                  ┌─────────┐
                  │ PENDING │ (새 단말, 사용자 결정 대기)
                  └────┬────┘
                       │ 사용자 확인
                       ▼
   ┌─────────────────────────────────────┐
   │            TRUSTED                  │ ← PRECALL/LIVENESS 발화 가능
   └────────────────────┬────────────────┘
                        │ 사용자가 분실/도난 신고
                        ▼
                  ┌──────────┐
                  │ REVOKED  │ ← 모든 게이트 거부
                  └──────────┘
```

### 4.3 인증 시점

| 시점 | 메커니즘 | 결과 |
|------|---------|------|
| **최초 등록** | App Attest (iOS) / Play Integrity (Android) — Apple/Google 체인 검증 | `trust_state = TRUSTED` |
| **재설치 (동일 deviceId)** | 기존 키 재사용 | `TRUSTED` 유지 |
| **기존 계정 + 새 단말** | 새 키 생성, Apple/Google 체인 검증 | `PENDING` → 사용자 확인 시 `TRUSTED` |
| **4시간마다** | 서명 하트비트 | `last_heartbeat_at` 갱신 |
| **하트비트 미수신** | 단말 오프라인 | LIVENESS 팬아웃 중단 |
| **서명 검증 실패** | 다음 세션에서 처음부터 재인증 | `attested = false` |
| **분실/도난 신고** | 사용자 트리거 | `REVOKED` |

---

## 5. API 명세 (출시 코드)

### 5.1 인증 (Main Backend)

```
POST /register/send-otp
  Body: { phone }
  Response: { ok }
  Action: Naver SENS로 SMS 발송

POST /register/complete
  Body: { phone, otp, password, deviceId }
  Response: { access_token, refresh_token }
  Action: INSERT users + INSERT refresh_tokens

POST /auth/refresh
  Body: { refresh_token, deviceId }
  Response: { access_token, refresh_token }
  Failure: DEVICE_MISMATCH if deviceId != stored
```

### 5.2 단말 인증 (VP API)

```
POST /v1/device/token
  Body: { fcmToken, platform }
  Response: { ok }
  Action: INSERT vp_device_token

POST /v1/attestation/challenge
  Response: { nonce }

POST /v1/attestation/verify
  Body: { keyId, attestationObject, platform }
  Response: { ok, trust_state }
  Action: Apple/Google 체인 검증 → INSERT vp_device_attestation, trust_state=TRUSTED

POST /v1/attestation/heartbeat
  Body: { keyId, signature, challenge, platform }
  Response: { ok }
  Action: 공개 키로 검증 → UPDATE last_heartbeat_at
  Failure: 다음 세션에서 처음부터 재인증
```

### 5.3 페어링 (VP API)

```
POST /v1/verification/request
  Body: { targetPhone }
  Response: { verificationId, status: 'PENDING' }
  
  Server gates:
  ① 속도 제한 (다축):
     - 사용자당 3회/10분
     - 대상당 1회/10분
     - 전역 상한
  ② org_directory 검사
  ③ 관계 게이트: family-tree ∪ prior-CONFIRMED
  ④ 단말 쿨다운 24시간
  ⑤ 전화번호 → 사용자 매핑
  
  Action: INSERT vp_verification (status=PENDING, exp=+5분)
          VERIFY_REQUEST push to all of target's devices

POST /v1/verification/respond
  Body: { verificationId, confirmed }
  
  Atomic UPDATE:
    WHERE status=PENDING
    AND expires_at > now
    AND target_user_id = current_user
  
  Result: 양측에 VERIFICATION_RESPONSE 푸시
          iOS CallDirectory / Android call-screening에 페어 등록
```

### 5.4 통화 시점 (VP API)

```
POST /v1/precall
  Body: { targetPhone, signature, keyId, ts }
  
  Server gates (네 가지 모두 통과):
  ① trust_state == TRUSTED
  ② last_heartbeat_at 신선
  ③ 서명이 저장된 공개 키와 일치
  ④ target ∈ A의 family-tree ∪ prior-CONFIRMED
  
  Success: PRECALL silent push to target's devices (FCM/APNs)
           { type:"PRECALL", callerName, callerPhone, ttl:30 }
  Failure: 401/403, 푸시 없음 (통화는 진행됨, 다만 녹색 표시 없음)

POST /v1/liveness/ping
  Trigger: A가 CHON 포그라운드
  
  Server:
  - Redis 사용자별 60초 슬롯 (과도한 발화 방지)
  - trust_state == TRUSTED 게이트 (PENDING/REVOKED 팬아웃 안됨)
  - fanOut(recipients):
    · recipients = family-tree ∪ CONFIRMED
    · 페어당 10분 스로틀 (Redis)
    · LIVENESS_UPDATE silent push
    · TTL = 15분
```

---

## 6. 페어링 흐름 상세

### 6.1 Phase 1: A의 요청 제출

```
A: 상대 전화번호 입력
↓
POST /v1/verification/request { targetPhone }
↓
서버 게이트 5종 통과 (위 5.3 참조)
↓
INSERT vp_verification (status=PENDING, exp=+5분)
```

### 6.2 Phase 2: B의 모든 단말로 VERIFY_REQUEST 팬아웃

```
VERIFY_REQUEST push (FCM/APNs)
↓
B 화면: "X님이 상호인증을 요청했습니다"
       (요청자 이름이 배너에 표시)
↓
B가 배너 탭 → 응답 페이지
↓
HOLD-to-confirm (예 / 아니오)
↓
POST /respond { confirmed: true }
↓
원자적 UPDATE:
  WHERE status=PENDING
  AND expires_at > now
  AND target_user_id=B
→ status = CONFIRMED
```

### 6.3 Phase 3: 양측 응답 팬아웃

```
A에게: VERIFICATION_RESPONSE { CONFIRMED }
B에게: VERIFICATION_RESPONSE { CONFIRMED }
↓
양측: iOS CallDirectory / Android call-screening에 페어 등록
↓
A와 B 사이의 다음 통화에 PRECALL이 무장됨
```

### 6.4 Hold-to-Confirm의 보안적 의미

- **푸시 배너 단순 탭은 위조/우발적 발화가 너무 쉬움**
- 응답 페이지는 확인 버튼을 **누른 채로 유지**하도록 요구
- 요청자의 **실제 계정 이름**을 읽고 결정할 충분한 시간 제공
- 보이스피싱은 수신자가 낯선 사람을 승인할 때만 작동 → 프롬프트가 그 낯선 사람을 가시화

---

## 7. PRECALL — 통화별 서명 (핵심 게이트)

### 7.1 시퀀스

```
1. A가 발신 (CHON 또는 시스템 다이얼러)
   Android: CallRedirectionService 트리거
   iOS: CHON 앱 내 다이얼러만 (시스템 다이얼러는 LIVENESS 대비책)
   
2. 하드웨어 칩 서명
   payload: "PRECALL|caller|target|ts"
   ↑ 위조 불가능한 증거

3. POST /v1/precall
   { targetPhone, signature, keyId, ts }

4. VP API 신뢰 게이트 (4-check ALL or NONE):
   ① trust_state == TRUSTED
   ② last_heartbeat_at 신선
   ③ 서명 검증 (저장된 공개 키)
   ④ target ∈ family-tree ∪ prior-CONFIRMED
   
   ※ 하나라도 실패 → 401/403, 푸시 없음
     (통화는 진행됨; 다만 녹색 표시 없음)

5. PRECALL silent push (FCM/APNs)
   { type:"PRECALL", callerName, callerPhone, ttl:30 }

6. B 단말: precall_cache 기록
   { callerPhone : expiresAtMs }

7. 정상 셀룰러 벨소리 (PRECALL 후 ~1-3초)

8. 벨 시점 — B의 단말 결정:
   Android: ChonCallScreeningService.onScreenCall(callDetails)
            → precall_cache 조회
            → 녹색 오버레이 + 음성 안내
   iOS:     잠금 화면 Live Activity (NSE 기동)
```

### 7.2 왜 가장 단단한 게이트인가

공격자가 **모두 가능**해도:
- Caller-ID 스푸핑 ✓
- SIM 포팅 ✓
- 비밀번호 도용 ✓
- 서버 침해 ✓

**피해자의 잠금해제된 실제 단말을 물리적으로 점유하지 않고는 유효한 PRECALL 서명을 만들 수 없습니다.**

> **칩이 바로 그 병목점입니다.**

---

## 8. LIVENESS_UPDATE — iPhone 시스템 통화 대비책

### 8.1 문제

iPhone은 사용자가 **시스템 전화 앱에서 발신할 때 PRECALL 발생 불가**:
- Apple이 서드파티 앱에 `CallRedirectionService` 등가 API를 제공하지 않음
- 모든 iPhone 시스템 다이얼러 통화가 PRECALL 없이 도달
- 대비책 없이는 SIM-swap처럼 보임

### 8.2 해결책

**LIVENESS_UPDATE 팬아웃**으로 Android 수신자의 캐시를 따뜻하게 유지.

### 8.3 흐름

**Phase 1: A가 CHON 포그라운드로 "살아있음" ping**
```
A: CHON 포그라운드 (앱 열기)
↓
POST /v1/liveness/ping
↓
recordActivity(userId):
  - Redis 사용자별 60초 슬롯
  - trust_state 조회
  - TRUSTED 전용 게이트
```

**Phase 2: family-tree ∪ prior-CONFIRMED로 팬아웃**
```
fanOut(recipients):
  - recipients = family-tree ∪ CONFIRMED
  - 페어당 10분 스로틀 (Redis)
  - LIVENESS_UPDATE silent push
↓
B 단말: liveness_cache 기록
  { A의 phone : expiresAtMs }
  TTL = 15분
```

**Phase 3: A가 iOS 시스템 전화 앱에서 발신 (PRECALL 발생 안됨)**
```
셀룰러 벨소리 (통화별 서명 없음)
↓
Android 수신자 대비책 경로:
  - PRECALL 미수신
  - contact.platform = ios
  - liveness_cache 신선도 확인 → 신선
  → state = VERIFIED · GREEN
```

### 8.4 trust_state 게이트의 이유

이전 버전은 `last_heartbeat_at` 신선도에 의존했으나, **신규 설치 직후 lastHeartbeat이 null**이라 팬아웃 차단 발견.

→ `trust_state == TRUSTED`로 전환하여 갭 메움.

**SIM-swap 방어는 그대로 유지**: PENDING/REVOKED 단말은 절대 팬아웃되지 않음.

---

## 9. 수신자 화면 표시 (3-state)

### 9.1 상태 매트릭스

| 상태 | 색상 | 트리거 | 동작 |
|------|------|--------|------|
| **VERIFIED** | 🟢 | PRECALL 신선 OR (iOS 연락처 AND LIVENESS 신선) | 녹색 오버레이 + 이름 + 음성 |
| **UNKNOWN** | 🟡 | 알려진 iOS 연락처, PRECALL/LIVENESS 모두 없음 | 노란 오버레이 + 이름 + 부드러운 주의 |
| **SIM-SWAP** | 🔴 | 알려진 Android 연락처, PRECALL 부재 | 빨간 오버레이 + 이름 숨김 + 강한 경고 |

### 9.2 SIM-SWAP 결정 로직 (정밀)

```
if (contact.platform == 'android'
    && contact.isAuthenticated
    && !precall_cache.fresh(contact.phone)) {
  → SIM-SWAP 상태
  → 이름 숨김 (스푸핑 방지)
}
```

이유: CHON Android 클라이언트는 인증된 연락처에 발신 시 **항상 `CallRedirectionService`를 통해 PRECALL을 발생**시킴. 인증된 Android 연락처에서 PRECALL 없이 들어오는 통화 = SIM-swap 시그니처.

### 9.3 Android — 전체 화면 오버레이

- 다이얼러 위에 전체 색상 오버레이
- 이름 표시 (SIM-SWAP은 익명)
- 음성 안내 (옵트인 시)

### 9.4 iOS — Apple이 허용하는 3가지 표면

| 표면 | 렌더링 | 제약 |
|------|------|------|
| **CallDirectory 라벨** | 통화 화면 정적 라벨 ("✓ {name} · 인증된 가족") | API는 사전 컴파일된 목록만 지원, 통화별 변경 불가 |
| **Live Activity** | 잠금 화면 + Dynamic Island, 30초 카운트다운, 녹색 CHON 실드 | Pro 모델만, 비-Pro는 Apple 전체 화면 UI에 가려짐 |
| **부재중 알림 후속** | "{name}님이 안전 통화를 시도했어요" | PRECALL 후 40초 서버 스케줄 푸시 |

> iOS는 의도적으로 약함 — Apple이 서드파티 앱에 통화 화면 그리기/벨 시점 코드 실행을 허용하지 않기 때문. 세 표면의 다층 방어로 갭을 메움.

---

## 10. 음성 안내 (Android)

### 10.1 정책

- **기본 비활성** — 갑작스러운 음성으로 놀라지 않도록
- 홈 페이지 인트로 카드로 의식적으로 옵트인
- 옵트인 사용자: 벨 시점 한국어 음성 안내

### 10.2 5단계 사전 검사

```
CallShieldVoiceAnnouncer.speak(state, contact.name, callId)

상태 결정 → 오버레이 표시 → 사전 검사

① if (!readVoiceAnnounceEnabled())     SKIP
② if (ringerMode != NORMAL)             SKIP  (방해금지/무음/진동 존중)
③ if (!ttsEngineReady)                  SKIP  (드물게: 설치 후 첫 통화)
④ if (alreadySpokenForThisCall)         SKIP  (재호출 간 중복 방지)
⑤ requestAudioFocus(TRANSIENT_MAY_DUCK)
   → 벨소리가 TTS 아래로 일시 낮아짐

→ tts.speak(phraseFor(state, name, publicMode), QUEUE_FLUSH)
```

### 10.3 음성 문구

| 상태 | 문구 | 정책 |
|------|------|------|
| VERIFIED | "안전합니다. {name}에게서 온 인증된 전화입니다." | 동사 우선, 0.5초 안에 판정 |
| UNKNOWN | "주의하세요. {name} 번호이지만 실시간 인증이 확인되지 않았습니다." | 부드러운 주의, 이름 발화 |
| SIM-SWAP | "주의하세요. 보이스피싱 의심 전화입니다. 받지 마세요." | **익명** — 이름 발화 안 함 |

### 10.4 공공장소 모드

- 토글로 녹색/노란색 문구에서 이름 제거
- SIM-SWAP은 토글 무관 항상 익명

### 10.5 TTS 시스템

- **Google TTS** — 무료, 온디바이스, 네트워크 없음
- `onCreate`에서 사전 워밍 → 콜드 스타트 흡수

### 10.6 iOS

**보류 상태**: Apple이 수신 측 통화별 코드 실행 훅을 제공하지 않아 TTS 발화 시점 없음.

---

## 11. 공격 시나리오 매트릭스 (12종)

2026년 5월 출시 코드 기준 — 모두 ACTIVE.

| # | 시나리오 | 방어 |
|---|---------|------|
| A | 무작위 사기꾼이 아들 사칭하여 할머니에게 전화 | CHON 페어 없음 → 녹색 라벨/음성 없음 |
| B | 사기꾼이 "아들"로 가입하여 할머니에게 인증 요청 | 푸시에 요청자 실제 계정 이름 표시 + Hold-to-confirm |
| C | 사기꾼이 아들 비밀번호 탈취 → Mallory 단말로 로그인 | 다음 갱신 시 `DEVICE_MISMATCH`. 아들 다른 단말로 알림 |
| D | C 동일하나 Mallory가 할머니에게 전화 시도 | PRECALL 신뢰 게이트가 `trust_state=TRUSTED` 요구. PENDING은 차단 → 빨간 SIM-SWAP |
| E | 사기꾼이 할머니에게 가는 FCM 푸시 가로챔 | 푸시 페이로드는 메타만 운반. 동작은 VP API JWT 검증 콜백 요구 |
| F | 시뮬레이터/탈옥으로 인증 위조 시도 | App Attest / Play Integrity 거부: 실제 하드웨어 + 유효 인증서 체인 필수 |
| G | 사기꾼이 오래된 인증 푸시 재전송 | 5분 TTL + 원자적 UPDATE로 재확인 방지 |
| H | **SIM-swap**: 공격자가 손자 번호를 가졌으나 칩은 없음 | PRECALL 서명 불가 → 빨간 SIM-SWAP + 경고 발화 (이름 숨김) |
| I | 분실 단말 → 사용자 신고 | `REVOKED` → 모든 게이트 거부 |
| J | iPhone 발신자가 시스템 다이얼러로 Android 할머니에게 전화 | LIVENESS_UPDATE 팬아웃이 캐시 신선 유지 → 녹색 표시 |
| K | 인증된 통화가 부재중으로 끝남 | 40초 후 서버 스케줄 부재중 푸시 |
| L | iPhone 발신자(시스템 다이얼러) → Android 부재중 | `TelephonyCallback` 네이티브 부재중 감지 + 인증 무장 → CHON 브랜드 로컬 알림 |

---

## 12. 출시 현황 (2026년 5월, dev/stg 브랜치)

### 12.1 ✅ ACTIVE

**하드웨어 및 인증**
- 하드웨어 결속 단말 키 (App Attest / StrongBox)
- 첫 로그인 인증
- 4시간 하트비트
- `trust_state` 컬럼 + 흐름

**세션 및 단말 잠금**
- refresh 시 device-mismatch 세션 폐기
- 새 단말 로그인 이메일 + 두 개의 CTA 푸시

**페어링 (상호인증)**
- 요청/응답/결과 UI + hold-to-confirm
- 5분 TTL + 원자적 응답 + 감사 로그
- 다축 레이트 리미터
- verify 시 24시간 단말 쿨다운 게이트
- 전화번호 변경 무효화 훅
- 가족 트리 ∪ 이전 CONFIRMED 관계 게이트

**통화 시점 방어**
- FCM 푸시 전달 + 만료 토큰 정리
- CONFIRMED 후 Call Shield 연락처 동기화
- 수신 통화 시 네이티브 통화 라벨링 (CallDirectory + screening) — 양쪽 모두
- PRECALL 하드웨어 서명 게이트
- LIVENESS_UPDATE 팬아웃 (TRUSTED 전용, 가족 ∪ CONFIRMED)
- PRECALL 윈도우용 iOS Live Activity (Pro 모델)
- 서버 스케줄 40초 부재중 후속 푸시
- Android 네이티브 부재중 감지 (TelephonyCallback)
- TTS 음성 안내 (Android) — 옵트인
- 음성 안내 홈 페이지 인트로 카드

### 12.2 ⏳ 대기 중 (MISSING)

- iOS 통화 후 요약 배너
- 서버 이상 탐지 (다중 통화 공격 버스트)

### 12.3 ❌ 불가능 (NOT FEASIBLE)

- PushKit-VoIP 위장을 통한 iOS 통화별 상태
- 포그라운드에서의 iOS 통화별 TTS (DEFERRED)

---

## 13. 핵심 불변 (Invariants)

### 13.1 하드웨어 비공개 키 절대 미반출

> 하드웨어 비공개 키는 보안 요소를 절대 떠나지 않습니다.
>
> 서버가 보는 것은 오직:
> - 공개 키 (인증 시 1회)
> - 서명 (하트비트, PRECALL, 재인증마다)
>
> **서버가 완전히 침해되더라도 유효한 서명을 위조할 수 없습니다.**

### 13.2 PRECALL 4-check 동시 통과

다음 4가지 중 하나라도 실패하면 푸시 없음:
1. `trust_state == TRUSTED`
2. `last_heartbeat_at` 신선
3. 서명 일치
4. 관계 게이트 통과

### 13.3 LIVENESS는 TRUSTED 전용

PENDING/REVOKED 단말은 절대 팬아웃되지 않음.

### 13.4 원자적 페어링 응답

```sql
UPDATE vp_verification
SET status = 'CONFIRMED'
WHERE status = 'PENDING'
  AND expires_at > NOW()
  AND target_user_id = ?
```

→ 재확인 / TOCTOU 공격 방지.

---

## 14. 공격자에게 열려 있는 두 개의 문

CHON 사용자에게 보이스피싱 성공을 위해 공격자는 **둘 다** 뚫어야 함:

### Door 1: 칩
- 피해자 실제 단말을 잠금해제 상태로 물리 점유, OR
- 보안 요소 키 추출 (2026년 현재 비현실적)

### Door 2: 페어링
- 수신자가 hold-to-confirm으로 가짜 계정 이름을 수동 수락
- 프롬프트가 실제 등록 이름을 노출 → 미스디렉션 탐지 가능

**두 문 모두 동시에 열려야 하며, 둘 다 비용·탐지 위험이 큼.**

---

## 15. 결론

보이스피싱은 수신자가 발신자 번호를 신뢰할 때 성공. 발신자 번호는 위조/SIM-swap/임대 모두 가능 → 전화번호 기반 방어는 모두 위험.

**CHON은 위조 불가능한 두 번째 신원 신호를 추가**: 셀룰러 벨소리 약 3초 전 도착하는 **하드웨어 결속 암호 서명**.

> **칩이 병목점입니다.**
>
> SIM-swap, 비밀번호 탈취, 발신자 번호 위조, FCM 가로채기 — 모두 무력화.
>
> 그 어느 것도 칩을 주지 않기 때문입니다.

---

## 부록 A. 용어집

자세한 정의는 별도 문서 `CHON_System_Architecture_v7.md`의 부록 A 참조.

핵심 용어:
- **PRECALL** — 하드웨어 서명 silent push, 셀룰러 벨 3초 전
- **LIVENESS_UPDATE** — iPhone 시스템 다이얼러 대비책 (TTL 15분)
- **trust_state** — TRUSTED / PENDING / REVOKED
- **상호인증** — 두 사용자 간 1회성 양방향 검증
- **CallDirectory (iOS)** — 정적 라벨, 통화별 변경 불가
- **CallScreeningService (Android)** — 벨 시점 수신 통화 가로채기
- **CallRedirectionService (Android)** — 발신 시점 통화 가로채기 (PRECALL 발화)
- **CXCallObserver (iOS)** — 호스트 프로세스 살아 있을 때만 발화
- **NSE** — Notification Service Extension, Live Activity 시작
- **SIM-swap** — 통신사 설득으로 번호 이전 (CHON 무력화 안 됨)
- **deviceId** — 물리 단말별 안정 식별자

---

**문서 끝**
