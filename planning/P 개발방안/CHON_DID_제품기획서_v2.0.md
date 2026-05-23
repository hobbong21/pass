# CHON DID 제품 기획서 v2.0

> **Relationship is the Identity.**
> 관계가 곧 신원입니다.

**관계 기반 차세대 탈중앙화 신원 인증 플랫폼**

| 항목 | 내용 |
|------|------|
| 버전 | v2.0 (Final) |
| 작성일 | 2026년 5월 |
| 대상 시스템 | CHON-DID Mobile App + Backend API + Blockchain + Graph DB |
| 기준 자료 | CHON_profile_2605.docx, 개선안 PPT, 디자인 시안 10종, 전체 구현 정리 |

---

## 📑 목차

### Part 1 — 사업 (Business)
1. [문제 — 디지털 신뢰의 공백](#1-문제--디지털-신뢰의-공백)
2. [CHON의 해법 — Mutual Authentication](#2-chon의-해법--mutual-authentication)
3. [핵심 차별점](#3-핵심-차별점)
4. [시장 기회](#4-시장-기회)
5. [적용 영역 — 3대 Use Case](#5-적용-영역--3대-use-case)
6. [트랙션 & 12개월 로드맵](#6-트랙션--12개월-로드맵)

### Part 2 — 사용자 경험 (UX)
7. [타겟 페르소나](#7-타겟-페르소나)
8. [End-to-End 사용자 여정](#8-end-to-end-사용자-여정)
9. [상호 인증 상세 여정](#9-상호-인증-상세-여정)
10. [관계 상태 머신](#10-관계-상태-머신)

### Part 3 — 정보 구조 (IA)
11. [5-Tab 정보 구조](#11-5-tab-정보-구조)
12. [상호 인증 화면 흐름](#12-상호-인증-화면-흐름)
13. [관계도 설정 UI — 현재 디자인](#13-관계도-설정-ui--현재-디자인)
14. [관계도 설정 UI — 인터랙션 상세 (NEW)](#14-관계도-설정-ui--인터랙션-상세-new)
15. [관계 그래프 결과물 — 3가지 시각화 모드](#15-관계-그래프-결과물--3가지-시각화-모드)

### Part 4 — 그래프 기술 (Graph Tech)
16. [왜 관계형 그래프 기술이 필요한가](#16-왜-관계형-그래프-기술이-필요한가)
17. [Graph DB 옵션 비교](#17-graph-db-옵션-비교)
18. [Memgraph + MariaDB — 하이브리드 아키텍처](#18-memgraph--mariadb--하이브리드-아키텍처)
19. [그래프 시각화 라이브러리 비교](#19-그래프-시각화-라이브러리-비교)
20. [최종 그래프 기술 스택 — 단계별 도입](#20-최종-그래프-기술-스택--단계별-도입)

### Part 5 — 기술 (Tech)
21. [시스템 아키텍처](#21-시스템-아키텍처)
22. [데이터 모델](#22-데이터-모델)

### Part 6 — 실행 (Execution)
23. [개발 로드맵 — 사업 마일스톤과 정렬](#23-개발-로드맵--사업-마일스톤과-정렬)
24. [성공 지표 (KPIs)](#24-성공-지표-kpis)
25. [Open Issues — 의사결정 필요 사항](#25-open-issues--의사결정-필요-사항)

---

# Part 1 — Business

## 1. 문제 — 디지털 신뢰의 공백

> 한국은 **모바일 금융 사용 세계 최상위 국가**이자 동시에 **보이스피싱 최대 피해국**

디지털 거래는 폭증했지만 "이 사람이 진짜인가?"를 증명할 신뢰 인프라는 존재하지 않습니다.

### 2025년 보이스피싱 피해 통계

| 지표 | 수치 |
|------|------|
| **2025년 보이스피싱 총 피해액 (한국)** | **1조 2,578억 원** |
| **전년 대비 총 피해액 증가** | **× 2.2** |
| **전년 대비 건별 피해 증가** | **× 1.9** |
| 건당 평균 피해액 | 5,300만 원 (전년 대비 +188%) |

**주요 유형**: 기관 사칭 · 통화 가로채기 · 지인 사칭 · 대출 빙자
**출처**: 경찰청

---

## 2. CHON의 해법 — Mutual Authentication

### 나를 아는 사람들의 상호 인증

| 기존 DID | CHON DID |
|----------|----------|
| **"무엇을 가졌는가"** | **"누가 너를 알고 있는가"** |
| 기기 · 암호키 · 발급 인증서 기반 | 관계 그래프 위의 상호 인증 · 지속 갱신 |

> 가족 · 동료 · 기관이 서로를 인증하며 형성된 관계 그래프 위에서 신뢰는 지속적으로 누적 · 검증 · 갱신되며, **그래프 밖에서 발생하는 사칭 · 도용은 구조적으로 차단됩니다.**

```
가족 ━━━ 동료 ━━━ 기관 ━━━ 지인
        (관계 그래프 위의 상호 검증)
```

---

## 3. 핵심 차별점

### ① 관계 기반 신뢰
기기 · 암호키가 아닌 **"나를 아는 사람"이 신원을 보증**. 피싱 · 도용에 구조적으로 강점.

### ② 특허 포트폴리오
- 삼중 인간 표준 디지털 계보 시스템 외 핵심 특허 3종 등록 (KR 10-2022)
- PCT 국제 출원 완료
- 추가 출원 진행 중 30여 종

### ③ 검증된 확장성
수백 년 축적된 **족보 데이터** 기반. 금융 · 헬스케어 · 조직 · 팬덤으로 단계적 확장.

---

## 4. 시장 기회

> 글로벌 DID 시장은 **2030년 약 USD 30B 규모, 연평균 90% 이상** 성장이 예상

한국은 모바일 뱅킹 사용율 78-82%로 세계 최상위권이면서 보이스피싱 피해가 폭증하는 **"디지털 신뢰 공백"이 가장 큰 시장**입니다.

| 지표 | 수치 |
|------|------|
| 2030년 글로벌 DID 시장 규모 | **USD 30B** |
| 연평균 시장 성장률 (CAGR) | **↑ 90%** |
| 한국 모바일 금융 · 인터넷 속도 | **Global #1** |

### 진입 전략
**"디지털 신뢰 공백이 가장 큰 시장(한국)"에서 "관계 기반 검증"으로 시작 → 글로벌 확장**

---

## 5. 적용 영역 — 3대 Use Case

동일 기반 DID 플랫폼 위에서 작동하는 3가지 사용 사례.

### CASE 01 — 통합 인증 (CHON-DID Core / Fandom / Org)

**핵심 기능**
- **Self ID**: 주민등록증 · 운전면허증 OCR 또는 직접 입력으로 본인 ID 생성
- **가계도**: 8개 1차 관계 기반 매트릭스 좌표 등록. 촌수 자동 계산
- **인증 포인트**: 쌍방 인증 완료 시 포인트 누적, 임계값 도달 시 DID 발급
- **글로벌 확장**: 해외 한인회 · 디아스포라 커뮤니티

**Why 종중 진입?**
- 수백 년 축적된 족보 데이터 (검증된 관계망)
- 가계도 기반 신뢰 모델이 가장 자연스럽게 작동
- 종친회 단위로 그룹 단위 온보딩 가능 (B2C가 아닌 B2Community)
- 시범 종중에서 검증된 사용자 경험을 글로벌 디아스포라로 확장

**목표**: 2027 Q2 — **100만 CHON ID 발급**

### CASE 02 — Anti-Scam (보이스피싱 방지) — 금융 · 통신

**5단계 처리 흐름**

| Step | 단계 | 처리 내용 |
|------|------|----------|
| 1 | 발신 감지 | 통신사 신호: 수신·발신 번호 확인 |
| 2 | 관계 조회 | 수신자의 CHON 관계 그래프 질의 |
| 3 | AI 분석 | 발신자의 관계 거리·이력 분석 |
| 4 | 위험도 | Trust Score 0~100 산출 |
| 5 | 차단·경고 | 임계값 초과 시 실시간 경고·차단 |

**Trust Score 산출 요소**

| 요인 | 가중치 |
|------|-------|
| 발신자가 수신자의 1차 관계망에 존재 | +40 |
| 발신자와 수신자가 공통 매트릭스 보유 (회사·학교 등) | +25 |
| 발신자의 그룹 신분증 활성 상태 | +20 |
| 최근 7일 내 정상 통화 이력 (수신자 입장) | +15 |

**판정 기준**
- **Trust Score < 30** → 통화 차단 알림
- **30 ~ 70** → 주의 알림
- **> 70** → 정상 표시

### CASE 03 — HDEP (Health Data Empowerment Platform) — 헬스케어

**질환별 혈연 위험 매트릭스**

CHON의 가계도 매트릭스 위에 의료 데이터를 매핑하면, 혈연 관계의 깊이에 따른 질환 발현 확률을 자동 산출.

**3대 응용**

1. **타깃 피험자 선별** — 특정 질환의 1·2촌 가족력 보유자만 정밀 추출. 임상시험 모집 비용 절감.
2. **장기 추적 코호트** — 혈연 관계 그래프 위에 다세대 의료 데이터 축적. 유전 질환의 장기 추세 분석.
3. **희귀질환 가족력 분석** — 유전성 희귀질환 가계 내 발현 패턴 자동 탐지. 조기 진단·예방 의학 기여.

**파트너십**: 마이헬스웨이 연계 + 제약·임상 파트너십
**런칭 목표**: 2027 Q1

---

## 6. 트랙션 & 12개월 로드맵

### VALIDATED — 검증 완료

- ✓ **핵심 특허 3종 등록** — KR 10-2022 · 삼중 인간 표준 디지털 계보 시스템 외 2건
- ✓ **PCT 국제 출원 완료** — 글로벌 진입 기반 확보 · 20여 건 추가 출원 진행 중
- ✓ **CHON-DID Family Tree PoC** — Self ID 생성 · 가계도 기반 촌수 네트워크 알고리즘 검증

### IN PROGRESS — 진행 중

- ○ **종중 시범 조직 온보딩** — 주요 종중과 파일럿 협의 진행
- ○ **Anti Voice-Phishing 알고리즘** — AI + DID 결합 발신자 검증 엔진 개발 중
- ○ **CHON-HDEP 파일럿 준비** — 마이헬스웨이 연계 기반 구조 설계
- ○ **B2B 파일럿 후보 협의** — 금융권 · 통신사 PoC 도입 논의 진행

### 12개월 상세 마일스톤

| Quarter | Phase | 핵심 산출물 |
|---------|-------|------------|
| **2026 Q3** | Foundation | 금융권 보이스피싱 차단 PoC 착수 · CHON-DID API 베타 공개 · 종중 시범 조직 온보딩 · B2B 파트너 후보 LOI 체결 |
| **2026 Q4** | Pilot Launch | CHON Anti-Scam 출시 · 보이스피싱 차단 유료 고객 확보 · 헬스케어 의료기관 연동 PoC · 종중 ID 발급 시작 |
| **2027 Q1** | Scale Up | CHON HDEP 정식 런칭 · B2B SaaS 첫 유료 계약 (인터넷전문은행/통신사) · 마이헬스웨이 연계 승인 추진 |
| **2027 Q2** | Standardization | B2B SaaS 정식 출시 · 매출 본격화 · 글로벌 디아스포라 (해외 한인회) 진입 · **100만 CHON ID 발급 돌파 목표** |

---

# Part 2 — UX

## 7. 타겟 페르소나

### Persona 1 — 이정수 (52세, 종친회 총무) · **1차 타겟**

| 항목 | 내용 |
|------|------|
| 직업 | 자영업, OO이씨 종친회 총무 5년차 |
| 디지털 익숙도 | 중간 (카카오·문자·전화 위주) |
| **Pain Point** | 엑셀로 가계도 · 회비 명부 관리, 신규 가입자 검증 불가 |
| **Need** | 가계도 자동 정리 + 그룹방 인증 멤버 운영 |

### Persona 2 — 김민지 (35세, 워킹맘) · **2차 타겟**

| 항목 | 내용 |
|------|------|
| 직업 | 마케팅 팀장 (서울 강남구 거주) |
| 디지털 익숙도 | 높음 (카카오·인스타·온라인 뱅킹 일상 사용) |
| **Pain Point** | 친정 · 시댁 친척 연락처 분실, 카톡 그룹방 혼선, 보이스피싱 우려 |
| **Need** | 친족 일괄 정리 + 가족 그룹방 + Anti-Scam 안전망 |

### Persona 3 — 박상훈 (28세, 대학원생) · **3차 타겟**

| 항목 | 내용 |
|------|------|
| 직업 | 공대 대학원생 (실험실 소속) |
| 디지털 익숙도 | 매우 높음 (Slack·Discord·GitHub 사용) |
| **Pain Point** | 동아리·연구실에 외부인 침입, 사칭 의심 |
| **Need** | 학과·기수 인증된 그룹방 + 졸업생 자동 분리 |

---

## 8. End-to-End 사용자 여정

Persona 2 (김민지) 기준 D0 ~ D30 여정 맵.

| Day | Stage | Action | Emotion |
|-----|-------|--------|---------|
| **D0** | 가입 | 전화번호 + SMS, 30초 가입 | 😊 안도 |
| **D0** | 첫 가치 | 연락처 동기화로 가입된 친지 자동 표시 | 🤩 놀라움 |
| **D1** | ID 생성 | 주민등록증 촬영 또는 직접 입력 | 🧐 주의 |
| **D3** | 첫 인증 | 어머니에게 관계 요청 발송 | ⏳ 기대 |
| **D5** | 쌍방 인증 | 어머니 승인 → 가계도 시각화 | 🎉 성취 |
| **D14** | 그룹 | 가족 그룹 생성 + 그룹 신분증 발급 | 🤝 신뢰 |

### Critical Moments (전환점)

| # | 시점 | 사용자 반응 |
|---|------|------------|
| **M-01** | 첫 30초 — 가입 완료 | "전화번호 한 번에 가입이 됐어?" |
| **M-02** | 첫 1분 — 연락처 매칭 | "이미 6명이 가입돼 있네?" |
| **M-03** | 첫 1주 — 첫 쌍방 인증 | "엄마가 진짜 우리 엄마라는 게 확인된 거예요" |
| **M-04** | 첫 2주 — 그룹 신분증 | "이 그룹방의 모든 멤버가 진짜 가족이라는 게 보증된 거예요" |

---

## 9. 상호 인증 상세 여정

발신자 A / 수신자 B 양측 관점의 swim lane.

### A (요청자) 흐름

| Step | 단계 | 상세 |
|------|------|------|
| **1** | **관계 요청** | B 선택 → 매트릭스 좌표 지정 (예: "어머니") |
| | (대기) | B의 응답 대기 (FCM 푸시 발송됨) |
| **3a** | **재제안 검토** | B의 재조정 안 확인 → 수용/거절 |
| | (인증 완료) | Confirmed 알림 + 가계도 업데이트 |
| **5** | **그룹 자격** | 그룹방 멤버 후보로 자동 등록 |

### B (수신자) 흐름

| Step | 단계 | 상세 |
|------|------|------|
| | (알림 수신) | FCM 푸시: "A님이 어머니 관계 요청" |
| **2** | **관계 검토** | A의 요청 확인 → 승인/재조정/거절 선택 |
| | (재조정 발송) | 다른 좌표 제안 (예: 어머니 → 이모) |
| **4** | **최종 확정** | A 승인 시 confirmed, DID 서명 트리거 |
| | (그룹 자격) | 그룹방 멤버 후보로 자동 등록 |

### 핵심 정책

| 항목 | 정책 |
|------|------|
| **재조정 한도** | 최대 3회 (무한 핑퐁 방지) |
| **응답 만료** | 30일 미응답 시 자동 expired |
| **푸시 알림 일정** | D+1, D+5, D+15, D+29 발송 |

---

## 10. 관계 상태 머신

`Relations.status` 컬럼이 가지는 5가지 상태와 전이 규칙.

```
        ┌──────────────────────┐
        │                      ▼
   ┌─────────┐  재조정    ┌──────────────┐   A 수용   ┌───────────┐
   │ PENDING │ ─────────▶│ RENEGOTIATING│──────────▶│ CONFIRMED │
   │ A 요청  │           │ B 재조정 제안 │           │ DID 발급  │
   └─────────┘           └──────────────┘           └───────────┘
        │ │                     │
        │ │ B 즉시 승인         │ 거절 / 한도 초과    ┌───────────┐
        │ └─────────────────────┼───────────────────▶│ REJECTED  │
        │                       │                    └───────────┘
        │ 30일 무응답           │
        ▼                       ▼
   ┌─────────┐                  │
   │ EXPIRED │◀─────────────────┘
   └─────────┘
```

| 상태 | 의미 | 다음 가능 상태 |
|------|------|-------------|
| `pending` | A가 관계 요청 발송 | confirmed, renegotiating, rejected, expired |
| `renegotiating` | B가 재조정 제안 (최대 3회) | confirmed, rejected, renegotiating (loop) |
| `confirmed` | 양측 합의 + DID 발급 | (종착) |
| `rejected` | B 거절 또는 재조정 한도 초과 | (종착) |
| `expired` | 30일 응답 없음 | (종착) |

---

# Part 3 — IA

## 11. 5-Tab 정보 구조

| 탭 | 역할 | 주요 화면 |
|----|------|----------|
| **홈** | 엔트리 포인트 | 온보딩, 튜토리얼, 알림, 최근 활동 카드, 빠른 진입 4개 아이콘 |
| **CHON** | 신원 관리 | 본인 ID, 발급 이력, DID 정보, 외부 공유 (QR/Deep Link) |
| **신분증 (중앙)** | 그룹 신분증 | 그룹별 발급된 신분증, 신분증 발급/회수, QR 표시 |
| **상호인증** | 인증 워크플로우 | 받은 요청, 보낸 요청, 진행 중 재조정, 인증 이력, 알림 센터 |
| **가계도** | 관계 시각화 | 가계도 트리, 편집 모드, 관계 선택 모달, 네트워크 뷰 (NEW) |

**디자인 특징**: 중앙 "신분증" 탭은 FAB(Floating Action Button) 스타일 오렌지 원형으로 강조.

---

## 12. 상호 인증 화면 흐름

### 발신자 측 — 6단계

| Step | 화면 | 동작 | 상세 |
|------|------|------|------|
| 1 | 가계도 | 편집 모드 진입 | [편집하기] 탭 |
| 2 | 관계 선택 모달 | 관계 카테고리 선택 | 8개 1차 관계 중 선택 |
| 3 | 대상자 선택 | 연락처에서 검색 | 이미 가입된 사용자만 노출 |
| 4 | 좌표 확정 화면 | 매트릭스 좌표 미리보기 | "어머니 · 1세대 · 첫째" 확인 |
| 5 | 요청 발송 | 요청 전송 + 알림 | FCM 푸시 발송, pending 표시 |
| 6 | 가계도 (업데이트) | 회색 squircle 표시 | 점선 테두리로 pending 시각화 |

### 수신자 측 — 5단계

| Step | 화면 | 동작 | 상세 |
|------|------|------|------|
| 1 | 푸시 알림 | FCM 푸시 수신 | "A님이 어머니 요청" |
| 2 | 상호인증 탭 | 요청 상세 확인 | 관계 좌표 + A 프로필 |
| 3 | 응답 선택 | 승인/재조정/거절 | 3개 액션 버튼 |
| 4a | (승인) | 확정 + DID 트리거 | 양측 가계도 업데이트 |
| 4b | (재조정) | 새 좌표 입력 | 최대 3회 핑퐁 제한 |
| 5 | 완료 알림 | 성공 시각화 | 오렌지 체크 + 토스트 |

---

## 13. 관계도 설정 UI — 현재 디자인

현재 디자인 시안은 **가족 카테고리 8개 1차 관계**에 한정 (Sprint 1-2 범위):

1. **가계도 메인** — 편집 진입 (`Family_Tree_01`)
2. **관계 선택 모달** — 8개 옵션 그리드 (`Family_Tree_select_03_02`)
   - 아버지/어머니 · 남편/아내 · 형(오빠)/누나(언니) · 남동생/여동생 · 아들/딸
3. **관계 확정** — 아들 선택 시 오렌지 강조 (`Family_Tree_select_03_03`)
4. **인증 완료 → 연락처 카드** — 프로필 사진 + 전화/문자/메시지 3개 액션 (`InProc_Contact_02`)

**시각 규칙**

| 요소 | 상태 | 시각 표현 |
|------|------|----------|
| 사용자 아이콘 | 본인 | 실 사진, 파란 squircle, 굵은 테두리 |
| 사용자 아이콘 | 남성 · 쌍방 인증 완료 | 파란색(#6FA8DC) squircle |
| 사용자 아이콘 | 여성 · 쌍방 인증 완료 | 회색(#BDBDBD) squircle |
| 사용자 아이콘 | 미인증 (pending) | 회색 squircle, 점선 테두리 |
| 관계 연결선 | 혈연 관계 | 오렌지(#F7931E) 실선 |
| 편집하기 버튼 | 기본 | Yellow(#FCD34D) pill 버튼 |

**Sprint 3에서 확장 필요**: 회사 · 학교 매트릭스 → 다음 섹션의 NEW 제안 참조.

---

## 14. 관계도 설정 UI — 인터랙션 상세 (NEW)

가족 카테고리를 넘어 회사·학교·커뮤니티 등 비위계 관계로 확장하기 위한 새 인터랙션 제안.

### STEP 1 — 카테고리 전환

화면 상단에 매트릭스 카테고리 탭. `[가족] [회사] [학교] [기본]`

- 탭 전환 시 해당 매트릭스 좌표로 가계도 재구성
- 활성 탭 오렌지 강조, 비활성 회색

### STEP 2 — 좌표 미리보기

매트릭스 시각화 + 라벨로 직관 입력.

```
       1자  2자  3자
조부 [  ][  ][  ]
부   [● ][  ][  ]  ← "아버지" 선택 시
본인 [  ][  ][  ]
```

- 좌표 `(axis_x, axis_y)`로 관계 자동 결정
- 사용자는 "이 자리에 어머니" 형태로 직관 입력

### STEP 3 — 연결 시각화

```
[ 어머니 ]  ← 회색 squircle + 점선 (pending)
    │       오렌지 실선
[ 나 ]      파란 squircle + 굵은 테두리
```

- **Pending**: 회색 squircle + 점선
- **Confirmed**: 남=파랑, 여=회색+사진
- **연결선**: 오렌지 실선

### STEP 4 — 뷰 전환 토글

`[Tree] [Graph]` 토글로 시각화 모드 전환.

- **Tree 모드**: 가계도 위계 시각화 (현재 디자인)
- **Graph 모드**: 관계 네트워크 시각화 (Force-Directed)
- **Path 모드**: 두 사람 사이의 인증 경로 표시

> **핵심 인사이트**: 가계도(Tree)는 친족 위계가 명확할 때만 작동. 회사·학교·커뮤니티는 비위계적 → **Graph 모드가 필요**.

---

## 15. 관계 그래프 결과물 — 3가지 시각화 모드

| 모드 | 부제 | 적합 | 기술 |
|------|------|------|------|
| **Tree View** | 위계적 가계도 | 가족 (parent-child 명확) | Native Flutter (graphview / CustomPainter) |
| **Network View** | Force-Directed Graph | 회사·학교·커뮤니티 (비위계) | WebView + Cytoscape.js / react-force-graph |
| **Path View** | 두 사람 사이의 인증 경로 | 신뢰 거리 시각화 (Anti-Scam 등) | Graph DB의 shortest-path 쿼리 결과 |

### Tree View

```
        ●
      ┌─┼─┐
      ●  ●  ●
     ┌┴┐
     ●  ●
```
가계도, 조직도 같은 명확한 위계.

### Network View

힘 기반 동적 배치(Force-Directed). 노드들이 자석처럼 자동 정렬되어 관계의 클러스터를 보여줌. 회사 부서별 그룹, 학교 동아리별 클러스터링에 효과적.

### Path View

```
[A] ──── [B] ──── [C] ──── [D]
 1촌    2촌    3촌    4촌
        Trust = 92
```

두 사람 사이의 최단 인증 경로. Anti-Scam에서 발신자와 수신자 사이의 신뢰 거리를 시각화.

---

# Part 4 — Graph Tech

## 16. 왜 관계형 그래프 기술이 필요한가

> CHON의 모든 사용 사례는 "관계 그래프" 위에서 작동합니다. RDBMS만으로는 핵심 쿼리가 불가능합니다.

### 4가지 핵심 쿼리 패턴

#### ① 다중 홉 탐색 (Multi-Hop)

**시나리오**: "본인으로부터 4촌수 이내의 모든 인원"

```cypher
MATCH (me)-[*1..4]-(kin) RETURN kin
```

**필요성**: Graph DB의 BFS는 ms 단위, RDBMS의 재귀 CTE는 초~분 단위.

#### ② 최단 경로 (Shortest Path)

**시나리오**: "이 발신자와 나 사이의 인증 경로"

```cypher
MATCH p = shortestPath((a)-[*]-(b)) RETURN p
```

**필요성**: Anti-Scam Trust Score 계산의 핵심. 실시간 응답 필요.

#### ③ 가족력 분석 (HDEP)

**시나리오**: "심장질환 진단받은 직계 친족"

```cypher
MATCH (me)<-[:CHILD_OF*]-(ancestor)
WHERE ancestor.disease = 'cardio'
RETURN ancestor
```

**필요성**: 혈연 매트릭스를 따라 의료 속성 전파. 다세대 추적.

#### ④ 그룹 자격 검증

**시나리오**: "그룹의 모든 멤버가 서로 confirmed인가"

```cypher
MATCH (g)<-[:MEMBER]-(u1), (g)<-[:MEMBER]-(u2)
WHERE NOT (u1)-[:CONFIRMED]-(u2)
RETURN u1, u2
```

**필요성**: N명 그룹 → N*(N-1)/2 관계 검증. 그래프 패턴 매칭 1쿼리로 해결.

---

## 17. Graph DB 옵션 비교

7개 선택지를 평가.

| 옵션 | 성능 | Cypher | 확장성 | 운영 부담 | 비용 | CHON 적합도 |
|------|------|--------|--------|----------|------|------------|
| **Neo4j AuraDB** | ★★★★ | Native | ★★★ | 낮음 (관리형) | 유료 | ★★★★★ |
| **Memgraph** ⭐ | ★★★★★ | Native (호환) | ★★★★ | 중간 (셀프) | 오픈+상용 | ★★★★★ |
| NebulaGraph | ★★★★★ | 유사 | ★★★★★ | 높음 | 오픈소스 | ★★★ |
| Amazon Neptune | ★★★ | Gremlin/SPARQL | ★★★★ | 낮음 (AWS) | 유료 | ★★★ |
| TigerGraph | ★★★★ | GSQL | ★★★★ | 중간 | 유료 | ★★ |
| Dgraph | ★★★ | GraphQL | ★★★ | 중간 | 오픈+상용 | ★★ |
| MariaDB 재귀 CTE | ★ | — | ★ | 낮음 (기존) | 기존 | ★ (PoC만) |

### 🎯 최종 추천

**Memgraph (Sprint 4 도입) + MariaDB (트랜잭션 유지) · CDC로 동기화**

---

## 18. Memgraph + MariaDB — 하이브리드 아키텍처

### Why Memgraph?

1. **In-Memory 아키텍처**로 sub-millisecond 응답 → Anti-Scam의 실시간 요구사항 충족
2. **Neo4j와 동일한 Cypher 쿼리 언어** → 지식 자산 호환, 향후 이전 자유 (벤더 락인 회피)
3. **오픈소스 코어 + 상용 지원** → 운영 옵션 유연
4. **MAGE (graph algorithm) 라이브러리** → 최단 경로·중심성 등 즉시 사용 가능

### 아키텍처 다이어그램

```
┌─────────────────────────┐
│  Mobile App (Flutter)   │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│  Spring Boot Backend    │
└───┬───────────────┬─────┘
    │               │
┌───▼────┐     ┌────▼──────┐
│MariaDB │◀──▶│ Memgraph  │
│트랜잭션│ CDC │그래프 쿼리│
│기존자산│     │ Real-time │
└────────┘     └───────────┘
   ⟷ Debezium CDC
```

### 쿼리 라우팅 규칙

| 쿼리 유형 | 라우팅 | 설명 |
|----------|--------|------|
| **READ (1-hop)** | → MariaDB | 친구 목록, 상태 조회 등 단순 조회 |
| **READ (Multi-hop)** | → Memgraph | 촌수, 경로, 가족력 분석 등 복잡 탐색 |
| **WRITE** | → MariaDB → CDC → Memgraph | 원본은 MariaDB, 변경분만 Memgraph로 sync |
| **REAL-TIME** | → Memgraph 단독 | Anti-Scam 통화 중 즉시 응답 (<10ms) |

### 데이터 동기화 — Debezium CDC

```
MariaDB Binlog → Debezium → Kafka → Memgraph Consumer
                  (변경 감지)         (그래프 갱신)
```

원본은 MariaDB 유지, 변경분만 그래프 DB로 실시간 sync. 데이터 무결성은 MariaDB에서 보장.

> **도입 시점**: Sprint 2-3까지 MariaDB 단독 (PoC) → Sprint 4부터 Memgraph 도입 (Anti-Scam과 함께)

---

## 19. 그래프 시각화 라이브러리 비교

| 옵션 | 타입 | 성능 | Flutter 통합 | 커스터마이징 | 학습 곡선 | 추천 용도 |
|------|------|------|------------|------------|---------|----------|
| graphview (Flutter) | Native | ★★★ | Native | ★★★ | 낮음 | Tree View (가계도) |
| **Custom Painter (Flutter)** ⭐ | Native | ★★★★ | Native | ★★★★★ | 높음 | 고도 커스텀 트리 |
| **Cytoscape.js + WebView** ⭐ | Web | ★★★★ | WebView | ★★★★★ | 중간 | Network View |
| **react-force-graph + WebView** ⭐ | WebGL | ★★★★★ | WebView | ★★★★ | 중간 | 3D 네트워크 (대규모) |
| Sigma.js + WebView | WebGL | ★★★★★ | WebView | ★★★ | 중간 | 대규모 그래프 (10K+) |
| G6 (Antv) + WebView | Web | ★★★★ | WebView | ★★★★★ | 중간 | 대시보드형 |
| D3.js + WebView | Web | ★★★ | WebView | ★★★★★ | 높음 | 완전 커스텀 |

### 🎯 추천 스택

- **Tree View**: Flutter CustomPainter (가족 트리)
- **Network View**: WebView + Cytoscape.js
- **Path View**: Cytoscape.js (커스텀 layout)
- **미래 옵션**: react-force-graph (3D 데모용)

---

## 20. 최종 그래프 기술 스택 — 단계별 도입

### Phase 1 — Sprint 1-3 · 현재 ~ 2026 Q3

- **MariaDB 단독** (재귀 CTE)
- **Flutter CustomPainter** (가계도)
- 단순 친구 검색

**상태**: PoC 단계. 1만 노드 이하. 기존 인프라 유지.

### Phase 2 — Sprint 4 · 2026 Q4

- **+ Memgraph 도입**
- **+ Debezium CDC** (MariaDB ↔ Memgraph 동기화)
- **+ Cytoscape.js (WebView)** — Network View

**상태**: Anti-Scam 출시와 함께 그래프 DB 도입. Trust Score 실시간 산출.

### Phase 3 — Sprint 5+ · 2027 Q1-Q2

- **Memgraph Cloud HA** (관리형 + 고가용성)
- **MAGE algorithms** (centrality, community detection)
- **react-force-graph** (3D 옵션)

**상태**: HDEP + 100만 ID 규모. 클라우드 관리형 + 고급 그래프 알고리즘.

### 핵심 안전 장치

> **Memgraph는 Cypher 호환** → 향후 Neo4j Aura로 이전 시 쿼리 그대로 사용 가능 (벤더 락인 회피)

---

# Part 5 — Tech

## 21. 시스템 아키텍처

5-Layer 구조.

| Layer | Tech Stack |
|-------|-----------|
| **1. Mobile App** | Flutter (Dart 3.6+) · BLoC · GoRouter · Dio + Retrofit |
| **2. API Gateway** | Spring Boot 3.2.5 · Java 21 · JWT · Rate Limiter (Redis) |
| **3. Business Logic** | Auth · Relation · Matrix · Group · Anti-Scam Service |
| **4. Data Layer** | MariaDB (트랜잭션) · Memgraph (그래프, Sprint 4+) · Redis (세션·캐시) |
| **5. External** | DID Blockchain · SMS Gateway · FCM · Clova OCR · 마이헬스웨이 (Sprint 5+) |

**핵심 변경점**: Sprint 4에 **Memgraph 추가** (Anti-Scam Trust Score 실시간 산출).

---

## 22. 데이터 모델

### MariaDB — Transactional (9개 핵심 엔티티)

| 테이블 | 주요 컬럼 | 역할 |
|-------|----------|------|
| Users | user_id, phone, name, status | 가입자 |
| AuthCodes | phone, code, expires_at | SMS OTP |
| ContactLinks | owner, target, hashed_phone | 연락처 매칭 |
| Relations | from, to, category, status | 관계 (쌍방 인증) |
| Matrix | user_id, category, axis_x/y | 매트릭스 좌표 |
| Groups | group_id, name, type, owner | 그룹방 |
| GroupMembers | group_id, user_id, role | 그룹 멤버 |
| GroupIDs | gid_id, did, signature | 그룹 신분증 |
| Disputes | rel_id, reason, evidence | 분쟁 |

### Memgraph — Graph (Sprint 4+)

**Nodes (정점)**

```cypher
(:Person {user_id, phone, name, status})
(:Group {group_id, type, category})
(:Matrix {matrix_id, category, x, y})
```

**Relationships (간선)**

```cypher
[:CONFIRMED {since, category, distance}]
[:PENDING {requested_at, expiring_at}]
[:MEMBER_OF {group_id, role, since}]
[:CHILD_OF {biological, verified}]
```

### 동기화

```
MariaDB Binlog → Debezium → Kafka → Memgraph
(실시간 그래프 갱신, MariaDB가 source of truth)
```

---

# Part 6 — Execution

## 23. 개발 로드맵 — 사업 마일스톤과 정렬

| Sprint | Quarter | Phase | 개발 산출물 | → 사업 마일스톤 |
|--------|---------|-------|------------|----------------|
| **Sprint 1-2** | 2026 Q3 | Foundation | • 전화번호 + SMS 가입 인프라<br>• Relations · Matrix DB<br>• 쌍방 인증 워크플로우<br>• 가계도 (Tree View) | CHON-DID API 베타 공개, 종중 시범 온보딩 |
| **Sprint 3-4** | 2026 Q4 | Pilot Launch | • 그룹 신분증 발급<br>• **Anti-Scam Trust Score 엔진**<br>• **Memgraph 그래프 DB 도입**<br>• **Network View (Cytoscape.js)** | CHON Anti-Scam 출시, 보이스피싱 차단 유료 고객 |
| **Sprint 5-6** | 2027 Q1 | Scale Up | • HDEP 데이터 모델<br>• 마이헬스웨이 연계<br>• B2B SaaS Admin Console<br>• 그래프 알고리즘 (MAGE) | HDEP 정식 런칭, B2B SaaS 첫 유료 계약 |
| **Sprint 7+** | 2027 Q2 | Standardization | • W3C DID Core 표준 호환<br>• 글로벌 다국어 (EN/JA/ZH)<br>• HA 인프라 (Memgraph Cloud)<br>• Path View · 3D Force Graph | B2B SaaS 정식 출시, 글로벌 디아스포라, **100만 ID 돌파** |

---

## 24. 성공 지표 (KPIs)

### Acquisition

| 지표 | Target |
|------|--------|
| 가입 완료 시간 | ≤ 30초 |
| 가입 전환율 | ≥ 70% |
| 연락처 동의율 | ≥ 60% |

### Activation

| 지표 | Target |
|------|--------|
| 첫 관계 등록 | ≤ 1일 |
| 쌍방 인증율 | ≥ 60% |
| 재조정율 | ≤ 15% |

### Engagement

| 지표 | Target |
|------|--------|
| 그룹 활성 비율 | ≥ 40% |
| 사용자당 그룹 수 | ≥ 2 |
| 월 신분증 발급 | 1,000+ |

### Retention

| 지표 | Target |
|------|--------|
| D1 리텐션 | ≥ 60% |
| D7 리텐션 | ≥ 45% |
| D30 리텐션 | ≥ 35% |

### Anti-Scam

| 지표 | Target |
|------|--------|
| Trust Score p95 응답 | < 50ms |
| 오탐율 (False Positive) | ≤ 2% |
| 차단 정확도 | ≥ 95% |

---

## 25. Open Issues — 의사결정 필요 사항

### 🔴 Sprint 1 Blocker (Sprint 0 의사결정 회의에서 즉시 결정 필요)

| ID | 항목 | 영향도 |
|----|------|-------|
| **D-09** | 기존 사용자 마이그레이션 정책 | Sprint 1 Blocker |
| **D-10** | SMS 게이트웨이 벤더 선정 | Sprint 1 Blocker |

### 🟠 Sprint 1-2 결정 필요

| ID | 항목 | 영향도 |
|----|------|-------|
| **D-04** | 미인증 채팅 한도 (1일 N개) | Sprint 1 |
| **D-11** | 실시간 동기화 방식 (WS / SSE / Polling) | Sprint 2 |
| **D-06** | 재조정 3회 초과 시 정책 | Sprint 2 |

### 🔵 그래프 기술 관련 (NEW)

| ID | 항목 | 영향도 |
|----|------|-------|
| **D-G1** | Memgraph 도입 시점 (Sprint 4 vs 5) | Sprint 4 |
| **D-G2** | WebView vs Native (네트워크 뷰 시각화) | Sprint 4 |
| **D-G3** | Trust Score 임계값 (30/70 기본안) | Anti-Scam 출시 전 |

### 🟢 장기 의사결정

| ID | 항목 | 영향도 |
|----|------|-------|
| **D-12** | W3C DID Core 호환 시점 | Sprint 7+ |

---

## 📂 함께 제공된 산출물

| 파일 | 내용 |
|------|------|
| `CHON_DID_제품기획서_v2.0.pptx` | 본 기획서의 PPT 버전 (38 슬라이드) |
| `CHON_DID_제품기획서_v1.0.docx` | 디자인 시안 임베드된 Word 버전 (49 페이지) |
| `CHON_의사결정_워크시트.xlsx` | Open Issues 14건 추적 관리 |
| `CHON_Sprint1_WBS.xlsx` | Sprint 1 WBS — 29개 작업, 60.5 MD |
| `chon-did-openapi.yaml` | OpenAPI 3.0 명세 (25개 엔드포인트) |
| `phase1~4 SQL 4종` | 단계별 DB 마이그레이션 스크립트 |

---

## 🎯 결론 — Three Key Takeaways

### 01. 보이스피싱 1.2조 시장의 구조적 해법

기존 DID는 "무엇을 가졌는가"를 묻지만, CHON DID는 "누가 너를 알고 있는가"를 묻는다. 관계 그래프 외부의 사칭·도용을 **구조적으로 차단**한다.

### 02. 3대 사용 사례, 동일 인프라 위에서 작동

CHON-DID Core (Identity), Anti-Scam (Voice Phishing), HDEP (Healthcare) — 모두 같은 관계 매트릭스 위에서 작동하므로 인프라 투자가 누적된다.

### 03. 그래프 기술로 검증되는 관계 신뢰 자산

Memgraph + MariaDB 하이브리드 아키텍처로 실시간 그래프 쿼리와 데이터 무결성을 동시 확보. Neo4j Cypher 호환으로 향후 이전 자유.

---

**CHON.INC** · [www.chon.ai](https://www.chon.ai)
*Product Specification v2.0 · May 2026*
