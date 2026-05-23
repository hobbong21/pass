# CHON 시스템 아키텍처 v7

> **버전**: v7 (PDF 기반 재정리)
> **상태**: dev / stg 브랜치 출시 코드 반영
> **날짜**: 2026년 5월
> **범위**: Mobile · Main Backend · VP API · Push
>
> ⚠️ 본 문서는 시스템 측면만 재정리합니다. UX/UI 디자인 (가계도, 학급증, 시각화 토폴로지) 은 별도 문서로 유지됩니다.

---

## 0. 한 문단 요약

CHON은 인증된 가족 구성원 간의 모든 통화에 **위조 불가능한 두 번째 신원 신호**를 추가합니다. 이 신호는 **Apple Secure Enclave 또는 Android StrongBox 내부에서 생성된 하드웨어 결속 암호 서명**이며, 셀룰러 벨소리가 울리기 약 3초 전에 수신자에게 전달됩니다.

### 핵심 원칙

> **CHON은 번호를 신뢰하지 않습니다. CHON은 하드웨어(칩)를 신뢰합니다.**

SIM-swap, 번호 스푸핑, Caller-ID 주입 — 어떤 것도 CHON을 무력화할 수 없습니다.

---

## 1. 시스템 컴포넌트 (4개)

모든 컴포넌트는 AWS `ap-northeast-2` 리전의 Application Load Balancer를 통해 HTTPS로 통신합니다.

### 1.1 Mobile App (iOS / Android · Flutter)

**책임**:
- UI 및 내비게이션
- 하드웨어 보관 키 (Secure Enclave / StrongBox)
- 네이티브 통화 라벨링 (CallKit / CallScreening)
- 음성 TTS 안내 (Android)
- Android 오버레이 UI
- iOS Live Activity
- PRECALL 발행 (Android)
- 수신자 상태 머신

### 1.2 Main Backend (Spring Boot 3.2 · MariaDB)

**책임**:
- 인증 및 사용자 관리
- HS512 JWT 발급
- Refresh 토큰 (deviceId 결속)
- Call-Shield 연락처
- 가족 트리 (`relation_users`)
- Naver SENS OTP
- 새 기기 알림
- 감사 로그 (`auth_events`)

**데이터베이스**: `chondb` (vendor MariaDB)
- `users` · `refresh_tokens` · `relation_users`

### 1.3 VP API (NestJS · RDS MariaDB)

**책임**:
- 상호인증 게이트
- 기기 인증 (App Attest / Play Integrity)
- 공개키 검증
- PRECALL 서명 게이트
- LIVENESS 팬아웃
- 신뢰 상태 머신 (TRUSTED/PENDING/REVOKED)
- 속도 제한 (다축)
- 감사 로그 (`vp_audit_log`)

**데이터베이스**: `chon_dev` / `chon_stg` (RDS · AES 저장 시 암호화)
- `vp_verification` · `vp_device_attestation` · `vp_device_token` · `vp_audit_log` · `vp_org_directory`

### 1.4 FCM + APNs (Push 전송)

**책임**:
- APNs 푸시 (iOS)
- FCM 푸시 (Android)
- 사일런트 데이터 푸시 (PRECALL, LIVENESS, VERIFY_REQUEST)
- Display 푸시 (40초 부재중 알림, 인증 결과 알림)
- 고우선 전송
- 벨 시점 신선도 보장

### 1.5 인증 경계

- **Main Backend가 HS512 JWT 발급**, VP API는 동일한 Secrets Manager 키로 검증
- JWT claim: `sub`, `uname`, `phone`
- VP API는 첫 요청 시 claim으로부터 자체 `users` 테이블 레코드 자동 생성
- **두 서비스는 데이터베이스를 공유하지 않음** — 신원만 공유

---

## 2. 신뢰 체인

### 2.1 단일 신뢰 근원: 하드웨어 칩

```
사용자의 물리적 단말
   ↓
Apple Secure Enclave / StrongBox
   ↓
비공개 키 (칩을 절대 떠나지 않음)
   ↓
↑ ECDSA P-256 서명 ↑
   ↓
서버: 공개 키 + trust_state 만 보관
```

### 2.2 서버 측 상태 (`vp_device_attestation`)

| 필드 | 설명 |
|------|------|
| `keyId` | 단말 결속 ID |
| `public_key` | ECDSA P-256 공개 키 |
| `platform` | `ios` \| `android` |
| `last_heartbeat_at` | ISO 타임스탬프 |
| `trust_state` | `TRUSTED` \| `PENDING` \| `REVOKED` |

### 2.3 인증 시점

- **최초 등록 시 1회**: Apple/Google 체인 검증 (App Attest / Play Integrity)
- **4시간마다**: 서명 하트비트로 갱신
- **하트비트 미수신 → 단말 오프라인** → LIVENESS 팬아웃 중단

### 2.4 핵심 불변 (Invariant)

> **하드웨어 비공개 키는 보안 요소를 절대 떠나지 않습니다.**
>
> 서버가 보는 것은 오직:
> - 공개 키 (인증 시 1회)
> - 서명들 (하트비트마다, PRECALL마다, 재인증마다)
>
> **서버가 완전히 침해되더라도 유효한 서명을 위조할 수 없습니다.**

### 2.5 단말 시나리오별 처리

| 상황 | 동작 |
|------|------|
| **최초 설치** | Apple/Google 체인 검증 후 `trust_state = TRUSTED` |
| **재설치 (동일 deviceId)** | `TRUSTED` 유지 |
| **기존 계정 + 새 단말** | `PENDING`으로 시작 → 사용자가 새 단말 알림 처리 시까지 유지 |
| **분실/도난** | 사용자가 설정에서 신고 → `REVOKED` |

---

## 3. 신원 계층 (6단계)

| 계층 | 정의 | 저장 위치 |
|------|------|---------|
| **1. 전화번호** | 셀룰러 MSISDN | 통신사 |
| **2. 계정 자격** | 이메일 + 전화 + 비밀번호 | Main Backend · `users` |
| **3. 세션** | HS512 JWT + refresh 토큰 | Main Backend · `refresh_tokens` |
| **4. 단말** | 하드웨어 키 + 인증 | VP API · `vp_device_attestation` |
| **5. 페어링** | 상호인증 | VP API · `vp_verification` |
| **6. 가족 트리** | 사용자가 추가한 관계 | Main Backend · `relation_users` |

### 3.1 왜 4계층과 5계층이 핵심인가

- **1~3계층만으로는 위조 가능** (SIM-swap, 비밀번호 탈취, 토큰 도용)
- **4계층 (하드웨어)**: Apple/Google 인증으로 신원을 물리 하드웨어와 묶음. 칩은 공격자가 획득하기 가장 어려운 단일 요소
- **5계층 (페어링)**: 수신자의 hold-to-confirm 실제 확인 요구. 우발적 승인 차단

**두 계층의 결합이 누가 누구에게 PRECALL/LIVENESS를 발생시킬 수 있는지를 정의합니다.**

---

## 4. 회원가입 → 첫 세션 (온보딩 흐름)

단일 흐름 안에서 4가지가 모두 완료됩니다:

### Phase 1: 계정 생성 (OTP + 비밀번호)

```
1. 사용자가 전화번호 입력
2. POST /register/send-otp → Naver SENS로 SMS 발송
3. 사용자가 OTP + 비밀번호 입력
4. POST /register/complete + deviceId
5. Main Backend: INSERT users + INSERT refresh_tokens
6. access + refresh JWT 반환
7. Mobile: Keychain / Keystore에 JWT 저장
```

### Phase 2: 세 가지가 병렬로 시작

**(a) 푸시 토큰 등록**
```
POST /v1/device/token { fcmToken, platform }
→ INSERT vp_device_token
```

**(b) 하드웨어 키 인증**
```
1. POST /v1/attestation/challenge → nonce 받음
2. generateKey() — iOS DCAppAttestService / Android Keystore EC
3. 보안 요소 내부에서 비공개 키 생성
4. keyId를 Keychain / Keystore에 저장
5. attestKey(nonce) → attestationObject (Apple/Google 서명)
6. POST /v1/attestation/verify
7. VP API: Apple/Google 체인 검증
8. INSERT vp_device_attestation, trust_state = TRUSTED
```

**(c) 4시간 하트비트 타이머 시작**
- iOS: NSTimer
- Android: WorkManager

### Phase 3: 정상 운영 시작

→ 사용자는 로그인 완료 · 인증 완료 · 푸시 수신 가능 · 운영 준비 완료

---

## 5. 4시간 하트비트

인증이 완료되면 단말은 4시간마다 살아있음 + 하드웨어 키 소유를 증명합니다.

### 5.1 흐름

```
1. 타이머 발화 (NSTimer / WorkManager)
2. POST /v1/attestation/challenge → 새 nonce
3. signChallenge(nonce, keyId)
   - iOS: generateAssertion()
   - Android: SHA256withECDSA
4. 보안 요소 내부에서 ECDSA 서명 (비공개 키)
5. POST /v1/attestation/heartbeat
   { keyId, signature, challenge, platform }
6. VP API: 저장된 공개 키로 검증
7. UPDATE last_heartbeat_at
```

### 5.2 실패 경로

서명 검증 실패 시:
- 서버: 해당 단말 `attested = false`
- 다음 세션에서 처음부터 재인증 트리거
- 새로운 App Attest / Play Integrity 체인
- **조용한 수락 없음. 체인은 양 끝까지 재검증됨**

---

## 6. 상호인증 (페어링 흐름)

두 사용자가 녹색 배너 통화를 주고받기 전, 페어링 합의 필요.

### 6.1 Phase 1: A가 인증 요청 제출

```
1. A가 상대 전화번호 입력
2. POST /v1/verification/request { targetPhone }

서버 게이트:
- 속도 제한 (다축):
  · 사용자당 3회/10분
  · 대상당 1회/10분
  · 전역 상한
- org_directory 검사
- 관계 게이트: family-tree ∪ prior-CONFIRMED
- 단말 쿨다운 24시간
- 전화번호 → 사용자 매핑

3. INSERT vp_verification
   status=PENDING, exp=+5분
```

### 6.2 Phase 2: B의 모든 단말로 VERIFY_REQUEST 푸시 팬아웃

```
1. VERIFY_REQUEST push (FCM / APNs)
2. B 화면: "X님이 상호인증을 요청했습니다"
   - 요청자 이름이 배너에 표시
3. B가 배너 탭 → 응답 페이지
4. HOLD-to-confirm 예/아니오
5. POST /respond { confirmed: true }

원자적 UPDATE
WHERE status=PENDING
AND expires_at > now
AND target_user_id=B
→ status = CONFIRMED
```

### 6.3 Phase 3: 양측에 VERIFICATION_RESPONSE 팬아웃

```
- A에게: { CONFIRMED }
- B에게: { CONFIRMED }
- 양측: iOS CallDirectory / Android call-screening에 페어 등록
→ A와 B 사이의 다음 통화에 PRECALL이 무장됨
```

### 6.4 Hold-to-Confirm의 이유

푸시 배너 단순 탭은 위조/우발적 발화가 너무 쉬움. 응답 페이지는 사용자가 **확인 버튼을 누른 채로 유지하도록 요구** → 요청자의 실제 계정 이름을 읽고 결정할 충분한 시간 제공.

> **보이스피싱은 수신자가 낯선 사람을 승인할 때만 작동합니다. 이 프롬프트는 그 낯선 사람을 가시화시킵니다.**

---

## 7. PRECALL — 통화별 서명 (실시간 방어의 핵심)

페어링된 CHON 사용자 간 모든 통화는 셀룰러 벨소리 약 3초 전 도착하는 **하드웨어 서명 사일런트 푸시**를 동반합니다.

### 7.1 흐름

```
1. A가 CHON에서 "B에게 전화" 또는 시스템 다이얼러로 발신
   (Android: CallRedirectionService)

2. 하드웨어 칩이 서명
   "PRECALL|caller|target|ts"
   ↑ 위조 불가능한 증거

3. POST /v1/precall
   { targetPhone, signature, keyId, ts }

4. 신뢰 게이트 — 네 가지 검사 모두 통과 필요:
   ① trust_state == TRUSTED
   ② last_heartbeat_at 신선
   ③ 서명이 저장된 공개 키와 일치
   ④ target ∈ A의 family-tree ∪ prior-CONFIRMED 파트너
   
   ※ 하나라도 실패 → 401/403, 푸시 없음
     (통화는 진행됨; 다만 녹색 표시 없음)

5. PRECALL 사일런트 푸시 (FCM/APNs)
   { type:"PRECALL", callerName, callerPhone, ttl:30 }

6. B가 precall_cache 기록
   { callerPhone : expiresAtMs }

7. 정상 셀룰러 벨소리 (PRECALL 후 ~1-3초)

8. 벨 시점 — 수신자 단말 결정:
   - Android: ChonCallScreeningService.onScreenCall(callDetails)
     → precall_cache 조회 → 녹색 오버레이 + 음성 안내
   - iOS: 잠금 화면 Live Activity (NSE 기동)
```

### 7.2 왜 가장 단단한 게이트인가

공격자가 **Caller-ID 스푸핑, SIM 포팅, 비밀번호 도용, 서버 침해까지 모두 가능**해도, **피해자의 잠금해제된 실제 단말을 물리적으로 점유하지 않고는 유효한 PRECALL 서명을 만들 수 없습니다**.

> **칩이 바로 그 병목점입니다.**

---

## 8. LIVENESS_UPDATE — iPhone 시스템 통화 대비책

### 8.1 문제

iPhone은 사용자가 시스템 전화 앱에서 발신할 때 PRECALL을 발생시킬 수 없음 (Apple이 서드파티 앱에 `CallRedirectionService` 등가 API를 제공하지 않음).

→ 대비책 없이는 모든 iPhone 시스템 다이얼러 통화가 PRECALL 없이 도달 → **SIM-swap처럼 보임**

### 8.2 해결: LIVENESS_UPDATE 팬아웃

Android 수신자의 캐시를 따뜻하게 유지 → iPhone 발신자도 녹색 받을 수 있도록.

### 8.3 흐름

**Phase 1: A가 CHON 포그라운드로, "살아있음" ping**
```
1. A가 CHON 포그라운드 (앱 열기)
2. POST /v1/liveness/ping
3. recordActivity(userId)
   - Redis에 사용자별 60초 슬롯 (과도한 발화 방지)
   - trust_state 조회 (vp_device_attestation)
   - TRUSTED 전용 게이트 (PENDING/REVOKED 팬아웃 안됨)
```

**Phase 2: family-tree ∪ prior-CONFIRMED로 팬아웃**
```
1. fanOut(recipients)
   - recipients = family-tree ∪ CONFIRMED
   - 페어당 10분 스로틀 (Redis)
   - LIVENESS_UPDATE 사일런트 푸시 발송
2. 수신자: liveness_cache 기록
   { A의 phone : expiresAtMs }
   TTL = 15분
```

**Phase 3: A가 iOS 시스템 전화 앱에서 발신 (PRECALL 발생 안됨)**
```
1. 셀룰러 벨소리 (통화별 서명 없음)
2. Android 수신자 대비책 경로:
   - PRECALL 미수신
   - contact.platform = ios
   - liveness_cache 신선도 확인 → 신선
   → state = VERIFIED · GREEN
```

### 8.4 trust_state 게이트 (하트비트 신선도 아님)

이전 버전은 `last_heartbeat_at` 신선도에 의존했으나, 신규 설치 사용자가 인증 직후 `lastHeartbeat`이 null이라 팬아웃 차단 발견 → `trust_state == TRUSTED`로 전환.

**SIM-swap 방어는 그대로 유지**: PENDING 및 REVOKED 단말은 절대 팬아웃되지 않음.

---

## 9. 수신자 화면 표시 (벨 시점 판정)

### 9.1 세 가지 상태

| 상태 | 색상 | 의미 | 음성 |
|------|------|------|------|
| **VERIFIED** | 🟢 녹색 | 하드웨어 검증 완료, 가족 페어링 확인 | "안전합니다." |
| **UNKNOWN** | 🟡 노란색 | 최근 인증 미갱신 — 주의 필요 | "주의하세요." |
| **SIM-SWAP** | 🔴 빨간색 | 인증된 페어이지만 칩 없이 걸려온 통화 | "보이스피싱 의심 전화입니다." |

### 9.2 SIM-SWAP의 결정적 신호

CHON Android 클라이언트는 **인증된 연락처에게 발신할 때 항상 CallRedirectionService를 통해 PRECALL을 발생시킴**.

→ **인증된 Android 연락처에서 PRECALL 없이 들어오는 통화 = 정확히 "SIM은 가졌지만 칩이 없는 공격자"의 모습**

이 상태에서는 공격자가 신뢰 표시를 악용하지 못하도록 **이름 숨김**.

### 9.3 Android — 전체 화면 오버레이

- 다이얼러 위 전체 색상 오버레이
- 이름 표시 (SIM-SWAP은 익명)
- 음성 안내 (옵트인)

### 9.4 iOS — Apple이 허용하는 범위

| 표면 | 렌더링 |
|------|------|
| **CallDirectory 라벨** | 통화 화면의 정적 라벨 — "✓ {name} · 인증된 가족". Apple의 API는 사전 컴파일된 목록만 지원 (통화별 변경 불가) |
| **Live Activity** (Pro 모델) | 잠금 화면 + Dynamic Island에 PRECALL 윈도우 동안 30초 카운트다운과 녹색 CHON 실드. NSE에서 시작. 비-Pro 모델에서는 Apple 전체 화면 UI에 가려짐 |
| **부재중 알림 후속** | 모든 PRECALL 후 40초 지나면 서버가 표시 가능한 FCM 푸시 발송: "{name}님이 안전 통화를 시도했어요" |

> iOS는 Android보다 의도적으로 약합니다. Apple이 서드파티 앱에 통화 화면을 그리거나 벨 시점에 코드를 실행할 수 있게 허용하지 않기 때문. **세 표면을 통한 다층 방어로 갭을 메움.**

---

## 10. 음성 안내 (Android)

### 10.1 목적

벨 시점에 한국어 음성 안내 → 고령 사용자가 배너를 읽기 전 판정을 들을 수 있음.

### 10.2 기본 비활성, 옵트인

- 홈 페이지 인트로 카드를 통해 의식적으로 활성화
- 갑작스러운 음성으로 놀라지 않도록

### 10.3 TTS 발화 전 5단계 검사

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

### 10.4 음성 문구

| 상태 | 문구 | 비고 |
|------|------|------|
| **VERIFIED** | "안전합니다. {name}에게서 온 인증된 전화입니다." | 동사 우선; 음성 첫 0.5초 안에 판정 |
| **UNKNOWN** | "주의하세요. {name} 번호이지만 실시간 인증이 확인되지 않았습니다." | 부드러운 주의; 이름은 발화됨 |
| **SIM-SWAP** | "주의하세요. 보이스피싱 의심 전화입니다. 받지 마세요." | **익명** — 이름 발화 안 함 (스푸핑 방지) |

### 10.5 공공장소 모드

- 지하철 등에서 엿들리는 것을 우려하는 사용자
- 토글로 녹색/노란색 문구에서 이름 제거
- SIM-swap 경로는 토글과 무관하게 항상 익명

### 10.6 TTS 시스템

- Google TTS — 무료, 온디바이스, 네트워크 없음
- `onCreate`에서 사전 워밍하여 콜드 스타트 흡수

### 10.7 iOS 보류 상태

Apple이 수신 측에서 통화별 코드 실행 훅을 제공하지 않으므로 TTS 발화 시점 없음.

---

## 11. 공격 시나리오 매트릭스

2026년 5월 기준 출시 코드.

| # | 시나리오 | 방어 계층 | 상태 |
|---|---------|---------|------|
| A | 무작위 사기꾼이 아들 사칭하여 할머니에게 전화 | CHON 페어 없음 → 녹색 라벨/음성 없음. 수신자는 라벨 없는 통화 의심 학습됨 | ✅ ACTIVE |
| B | 사기꾼이 "아들"로 가입하여 할머니에게 인증 요청 | 푸시에 요청자 실제 계정 이름 표시. Hold-to-confirm이 우발적 탭 방지 | ✅ ACTIVE |
| C | 사기꾼이 아들 CHON 비밀번호 탈취 → Mallory 단말로 로그인 | Mallory 단말은 자체 인증 키 생성. 이전 refresh 토큰은 다음 갱신 시 `DEVICE_MISMATCH`. 아들 다른 단말로 이메일+푸시 알림 | ✅ ACTIVE |
| D | C와 동일하나 Mallory가 할머니에게 전화 시도 | PRECALL 신뢰 게이트가 `trust_state=TRUSTED` 요구. 새 단말은 PENDING 시작. PRECALL → 403. Android는 빨간색 + "보이스피싱 의심" 음성 | ✅ ACTIVE |
| E | 사기꾼이 할머니에게 가는 FCM 푸시 가로챔 | 푸시 페이로드는 type과 이름만 운반. 동작은 VP API JWT 인증 콜백 요구. JWT는 할머니 deviceId에 결속 | ✅ ACTIVE |
| F | 시뮬레이터/탈옥으로 인증 위조 시도 | App Attest / Play Integrity가 거부: 실제 iOS 하드웨어 AND 유효한 Apple/Google 인증서 체인 필수 | ✅ ACTIVE |
| G | 사기꾼이 오래된 인증 푸시 재전송 | 인증은 5분 안에 만료. respond의 원자적 UPDATE가 재확인 방지. 모든 상태 전이 감사 로그 기록 | ✅ ACTIVE |
| H | **SIM-swap**: 공격자가 손자 번호를 가졌으나 칩은 없음 | SIM은 가졌지만 칩 없음. PRECALL 서명 불가. 셀룰러 통화가 하드웨어 검증된 푸시 없이 도달 → Android는 빨간색 + 경고 발화. 이름 발화 안 함 | ✅ ACTIVE |
| I | 분실 단말 → 사용자가 설정에서 신고 | 이전 단말 `REVOKED`. 신뢰 게이트가 해당 단말 PRECALL/LIVENESS 발화 거부. 단말 가진 공격자도 녹색 못 띄움 | ✅ ACTIVE |
| J | iPhone 발신자가 시스템 다이얼러로 Android 할머니에게 전화 | LIVENESS_UPDATE 팬아웃이 Android 수신자 캐시 신선 유지. PRECALL이 발화 안 해도 인증된 녹색 표시 | ✅ ACTIVE |
| K | 인증된 통화가 부재중으로 끝남 | PRECALL 후 40초 지나면 서버가 CHON 브랜드 부재중 푸시 발송. 탭하면 해당 연락처 call-shield 페이지 이동 | ✅ ACTIVE |
| L | iPhone 발신자(시스템 다이얼러) → Android 부재중 | `TelephonyCallback`을 통한 네이티브 부재중 감지: `RINGING → IDLE` without `OFFHOOK` + 인증된 연락처 무장 → CHON 브랜드 로컬 알림 발화 | ✅ ACTIVE |

---

## 12. 저장 데이터 (전체)

### 12.1 폰 — 보안 저장소

| 위치 | 키/테이블 | 주요 필드 | 용도 |
|------|---------|---------|------|
| Keychain / Keystore | `kLoginModel` | accessToken, refreshToken, userName, phone | 세션 부트스트랩 |
| Secure element<br>(App Attest / StrongBox) | 하드웨어 결속 키 | 비공개 키 (외부 미반출) + keyId | 실제 단말 증명 |
| EncryptedSharedPrefs (Android) /<br>AppGroup UserDefaults (iOS) | `precall_cache` | { callerPhone : expiresAtMs } | 통화별 신선도 |
| 동일 | `liveness_cache` | { callerPhone : expiresAtMs } | 대비책 활성도 |
| 동일 | `voice_announce_*` | enabled, public_mode | TTS 환경설정 |

### 12.2 Main Backend — chondb (벤더 MariaDB)

| 테이블 | 주요 필드 | 용도 |
|--------|---------|------|
| `users` | id, phone, hashed password, email | 신원 |
| `refresh_tokens` | userId, tokenJti, familyId, deviceId, expiresAt | 세션 + 단말 잠금 |
| `relation_users` | cert_owner_id, cert_related_id, cert_related_phone | 가족 트리 |
| `auth_events` | userId, event, ip, ua, ts | 감사 + 새 단말 트리거 |

### 12.3 VP API — chon_dev / chon_stg (RDS MariaDB · 저장 시 암호화)

| 테이블 | 주요 필드 | 용도 |
|--------|---------|------|
| `vp_device_token` | userId, platform, fcmToken, deviceId | 푸시 대상 |
| `vp_device_attestation` | userId, keyId, public key, platform, last_heartbeat_at, trust_state | 하드웨어 결속 단말 증명 |
| `vp_verification` | id, requester_id, target_phone, target_user_id, status, expires_at | 페어링 |
| `vp_audit_log` | verification_id, action, actor_user_id, ts | 행위 기록 |
| `vp_org_directory` | phone, org_name, org_type | 알려진 사업자 번호 |

### 12.4 핵심 불변

> **비공개 하드웨어 키는 결코 네트워크를 건너지 않습니다.**
>
> 서버는 공개 키(인증 시 단 1회)와 서명(하트비트 / PRECALL / 재인증 챌린지마다)만 봅니다.
>
> **다른 모든 상태는 복구 가능하지만, 칩은 그렇지 않습니다.**

---

## 13. 현황 요약 (2026년 5월)

### 13.1 ✅ ACTIVE — 출시 코드 반영

**하드웨어 및 인증**
- 하드웨어 결속 단말 키 (App Attest / StrongBox)
- 첫 로그인 인증
- 4시간 하트비트
- `trust_state` 컬럼 (TRUSTED/PENDING/REVOKED) + 흐름

**세션 및 단말 잠금**
- refresh 시 device-mismatch 세션 폐기
- 새 단말 로그인 이메일 + 두 개의 CTA 푸시

**페어링 (상호인증)**
- 요청 / 응답 / 결과 UI + hold-to-confirm
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

### 13.2 ⏳ 대기 중

- iOS 통화 후 요약 배너 — MISSING
- 서버 이상 탐지 (다중 통화 공격 버스트) — MISSING

### 13.3 ❌ 불가능

- PushKit-VoIP 위장을 통한 iOS 통화별 상태 — NOT FEASIBLE
- 포그라운드에서의 iOS 통화별 TTS — DEFERRED

---

## 14. 공격자가 뚫어야 하는 두 개의 문

CHON 사용자에게 보이스피싱 성공을 위해 공격자는 **두 가지 모두**를 뚫어야 함.

### Door 1: 칩

피해자의 실제 단말을, 잠금 해제된 상태로, PRECALL을 발화시킬 수 있을 만큼 **물리적으로 점유**하거나 — **보안 요소 키를 추출**해야 함.

→ 후자는 2026년 시점 Secure Enclave / StrongBox에 대해 **현실적인 능력이 아님**.

### Door 2: 페어링

수신자가 이미 신뢰하는 가짜 계정 이름으로 새 상호인증 요청을, **hold-to-confirm**과 함께, 수동으로 수락하도록 설득해야 함.

→ 프롬프트는 요청자의 실제 등록 이름을 보여주므로, **미스디렉션은 탐지 가능**.

### 두 문 모두 동시에 열려야 함

- **Door 1**: 드물고 비용이 큼
- **Door 2**: 탐지 가능 (페어링이 실제 계정 이름 노출)

> 시스템은 이 조합의 비용을 충분히 높게 설계해, SIM-swap 기반 보이스피싱이 CHON 사용자에게는 단순히 작동하지 않도록 함.
>
> SIM, 번호, 비밀번호, FCM 스트림 — 그 어느 하나도 단독으로는 충분하지 않으며, 대부분의 공격자는 두 문 중 한쪽조차 뚫을 수 있을 뿐.

---

## 15. 결론

보이스피싱은 수신자가 **발신자 번호를 신뢰**할 때 성공합니다. 발신자 번호는 위조, SIM-swap, 다크넷 마켓 임대가 모두 가능 → 전화번호 기반 방어는 본질적으로 모두 위험에 노출.

**CHON은 위조 불가능한 두 번째 신원 신호를 더합니다**: 셀룰러 벨소리가 울리기 약 3초 전, 수신자에게 전달되는 **하드웨어 결속 암호 서명**.

### 서명은 동시에 네 가지에 결속

1. **비밀번호** — 사용자의 메인 백엔드 자격 (`users`)
2. **하드웨어 키** — App Attest / StrongBox (`vp_device_attestation`)
3. **상호 확인** — 두 명의 실제 CHON 사용자 간 (`vp_verification`)
4. **TRUSTED 상태** — 서명 시점의 `trust_state` 컬럼

### 수신자 단말은 벨 시점에 판정 표시

- 🟢 **GREEN** — 하드웨어 검증된 페어 ("안전합니다.")
- 🟡 **YELLOW** — Pending 또는 liveness 전용 ("주의하세요.")
- 🔴 **RED** — 알려진 페어, 칩 없음 ("보이스피싱 의심")

### 핵심 메시지

> **칩이 병목점입니다.**
>
> SIM-swap, 비밀번호 탈취, 발신자 번호 위조, FCM 가로채기 — 모두 무력화됩니다.
>
> 그 어느 것도 칩을 주지 않기 때문입니다.
>
> **CHON은 번호를 신뢰하지 않습니다. CHON은 하드웨어를 신뢰합니다.**

---

## 부록 A. 용어집

### PRECALL
발신자의 CHON에서 수신자의 CHON으로 보내는 **하드웨어 서명된 silent 푸시**. 셀룰러 벨 약 3초 전 전송. 시스템에서 가장 단단한 암호 게이트.

### LIVENESS_UPDATE
서버가 팬아웃하는 silent 푸시: "사용자 A가 지금 살아 있고 온라인이다"를 A의 인증된 가족에게 전송. Apple 제약으로 iOS 다이얼러 통화에서 PRECALL이 불가능할 때, 수신자가 대비책 녹색 트리거로 사용. **TTL 15분**.

### trust_state
단말별 서버 측 상태:
- **TRUSTED** — 정상
- **PENDING** — 진행 중이거나 사용자 결정을 기다리는 새 단말
- **REVOKED** — 분실 폰 리셋

TRUSTED 단말만이 PRECALL이나 LIVENESS를 발화할 수 있음.

### 상호인증 (mutual auth)
두 CHON 사용자 간의 일회성 양방향 검증. `vp_verification`에 CONFIRMED 상태로 저장. 어느 한 쪽이 폐기할 때까지 지속.

### CallDirectory (iOS)
Apple의 서드파티 발신자 ID 확장 API. 통화 화면에 정적 라벨 추가 가능, **통화별 변경 불가** (라벨은 사전 컴파일되어 벨 시점에 읽힘).

### CallScreeningService (Android)
벨 시점에 수신 통화를 가로채기 위해 등록하는 시스템 서비스. 전체 상태 정보와 함께 `onScreenCall` 실행 → 오버레이 그리고 음성 안내 발화.

### CallRedirectionService (Android)
다이얼 시점에 발신 통화를 가로채기 위해 등록하는 시스템 서비스. **사용자가 시스템 다이얼러에서 인증된 연락처에 전화 시 PRECALL을 발화**.

### CXCallObserver (iOS)
수신 통화 상태 변화에 대한 수동적 관찰자. **호스트 프로세스가 살아 있을 때만 발화**. 중단된 앱은 콜백 못 받음 → iOS 부재중 후속이 서버 스케줄 푸시로 옮겨간 이유.

### NSE (Notification Service Extension, iOS)
푸시 수신 시 시스템 표시 전에 자체 프로세스에서 실행. Live Activity 시작과 푸시 컨텐츠 장식에 사용.

### SIM-swap
공격자가 통신사를 설득하여 피해자의 번호를 자신이 통제하는 SIM으로 이전하는 공격. 모든 전화번호 기반 방어를 무력화. **CHON은 무력화되지 않음** — 공격자가 여전히 피해자의 칩을 가지지 못함.

### deviceId
물리적 단말별 안정 식별자:
- iOS: `identifierForVendor`
- Android: `Settings.Secure.ANDROID_ID`

refresh 토큰 행에 결속. 다른 단말이 동일한 JWT 사용 시 다음 갱신에서 `DEVICE_MISMATCH` 발화.

---

**문서 끝**
