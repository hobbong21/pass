# CONTRIBUTING.md — 컨트리뷰션 가이드

> **목적**: CHON DID 개발에 참여하는 모든 인원이 따라야 할 워크플로우, 코드 스타일, 리뷰 규칙을 정의합니다.

---

## 📑 목차

1. [기여하기 전에](#1-기여하기-전에)
2. [개발 워크플로우](#2-개발-워크플로우)
3. [브랜치 전략](#3-브랜치-전략)
4. [커밋 메시지 규칙](#4-커밋-메시지-규칙)
5. [코드 스타일](#5-코드-스타일)
6. [PR (Pull Request) 가이드](#6-pr-pull-request-가이드)
7. [리뷰 정책](#7-리뷰-정책)
8. [테스트 작성 가이드](#8-테스트-작성-가이드)
9. [문서화](#9-문서화)
10. [질문 및 도움 받기](#10-질문-및-도움-받기)

---

## 1. 기여하기 전에

### 사전 준비 — 필독 문서

1. [README.md](../README.md) — 프로젝트 전체 이해 + Quick Start
2. [DESIGN.md](DESIGN.md) — 시스템 아키텍처, 데이터 흐름, 보안 정책
3. [TECH.md](TECH.md) — 기술 스택 + 의사결정 매트릭스
4. [ROADMAP.md](ROADMAP.md) — 현재 Sprint와 다음 Sprint 목표

### 개발 환경 설정

[README.md의 Quick Start](../README.md) 절차를 따라 로컬 환경을 구성하세요. 환경 셋업 후 본 문서로 돌아와 워크플로우를 읽습니다.

### 행동 기준

이 프로젝트는 CHON.INC 사내 전용입니다. 사내 윤리 강령 및 정보보안 규정에 준합니다. 외부 컨트리뷰터에 한해 다음 원칙을 적용합니다:

- 다른 컨트리뷰터를 존중하고 친절하게 소통합니다
- 건설적 비판은 환영, 인신공격은 금지
- 사실 기반 논의 — 코드 리뷰는 코드에 대해서만
- 보안·개인정보 관련 정보는 절대 공개 채널에 게시하지 않음 (→ security@chon.ai)

---

## 2. 개발 워크플로우

```
1. 이슈 확인 또는 생성
       │
       ▼
2. develop에서 feature 브랜치 생성
       │
       ▼
3. 로컬 개발 + 테스트
       │
       ▼
4. 커밋 (Conventional Commits)
       │
       ▼
5. PR 생성 (Draft → Ready)
       │
       ▼
6. CI 통과 + 리뷰 (≥ 2명 승인)
       │
       ▼
7. develop에 squash merge
       │
       ▼
8. dev 환경 자동 배포
       │
       ▼
9. (선택) release 브랜치로 prod 배포
```

### 단계별 상세

#### Step 1. 이슈 확인 또는 생성

- 기존 이슈 검색: [Issues](https://github.com/chon-inc/chon-did/issues)
- 새 이슈 생성 시: [Issue Templates](.github/ISSUE_TEMPLATE/) 사용
  - 🐛 Bug Report
  - ✨ Feature Request
  - 🤔 Decision Required (결정 필요)
  - 📝 Documentation
- 이슈에 자기 자신을 assign

#### Step 2. 브랜치 생성

```bash
git checkout develop
git pull origin develop
git checkout -b feature/issue-123-add-otp-verification
```

브랜치 명명 규칙은 [§3 브랜치 전략](#3-브랜치-전략) 참조.

#### Step 3. 로컬 개발

```bash
# Backend
cd backend
./gradlew bootRun

# Mobile
cd mobile
flutter run
```

#### Step 4. 커밋

[§4 커밋 메시지 규칙](#4-커밋-메시지-규칙) 참조.

```bash
git add .
git commit -m "feat(auth): SMS OTP 검증 로직 추가 (#123)"
```

#### Step 5. PR 생성

```bash
git push origin feature/issue-123-add-otp-verification
```

GitHub에서 PR 생성 → [PR Template](.github/PULL_REQUEST_TEMPLATE.md) 작성.

처음에는 **Draft PR**로 생성하고, 작업 완료 후 **Ready for review**로 전환.

#### Step 6-7. 리뷰 & 머지

[§6 PR 가이드](#6-pr-pull-request-가이드)와 [§7 리뷰 정책](#7-리뷰-정책) 참조.

---

## 3. 브랜치 전략

**채택: GitHub Flow + release 브랜치 (간소화된 Git Flow)**

```
main ─────────────────────────●─────●──────●─── (production, tagged releases)
                              ↑     ↑      ↑
                       release/  release/  release/
                       v1.0      v1.1      v1.2

develop ───●───●───●──●─●──●─●──●──●─●──●─●──●── (dev 환경 배포)
           │   │   │  │ │  │ │  │  │ │  │ │
           ▼   ▼   ▼  ▼ ▼  ▼ ▼  ▼  ▼ ▼  ▼ ▼
        feature/* (PR 단위로 squash merge)
```

### 브랜치 종류

| 브랜치 | 용도 | 생성 위치 | 머지 대상 |
|--------|------|----------|----------|
| `main` | 프로덕션 (태그된 릴리스) | - | (직접 커밋 금지) |
| `develop` | 개발 통합 (dev 환경) | main에서 분기 | - |
| `feature/*` | 새 기능 개발 | develop에서 분기 | develop |
| `bugfix/*` | 버그 수정 | develop에서 분기 | develop |
| `release/*` | 릴리스 준비 | develop에서 분기 | main + develop |
| `hotfix/*` | 프로덕션 긴급 수정 | main에서 분기 | main + develop |

### 브랜치 명명 규칙

```
<type>/<issue-id>-<short-description>
```

예시:
- `feature/123-add-otp-verification`
- `bugfix/456-fix-relation-state-transition`
- `release/v1.2.0`
- `hotfix/789-critical-jwt-bypass`

### 보호 규칙

| 브랜치 | 규칙 |
|--------|------|
| `main` | 직접 push 금지, PR만 허용, 2명 이상 승인 필수, CI 통과 필수 |
| `develop` | 직접 push 금지, PR만 허용, 1명 이상 승인 필수, CI 통과 필수 |
| 기타 | 자유 |

---

## 4. 커밋 메시지 규칙

**채택: Conventional Commits + 한국어 본문**

### 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 종류

| Type | 사용 |
|------|------|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `style` | 코드 의미에 영향 없는 변경 (포맷팅, 세미콜론) |
| `refactor` | 기능 변경 없는 코드 개선 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 의존성, 설정 변경 |
| `ci` | CI/CD 변경 |
| `revert` | 이전 커밋 되돌리기 |
| `security` | 보안 관련 변경 |

### Scope 예시

`auth`, `relation`, `matrix`, `group`, `anti-scam`, `hdep`, `ui`, `api`, `db`, `infra`, `docs`

### Subject 작성 규칙

- 50자 이내
- 한국어 또는 영어 (혼용 가능)
- 명령형 어조 ("~를 추가했다" ❌, "~ 추가" ✅)
- 마침표 없음

### Body (선택)

- 72자에서 줄바꿈
- "무엇을, 왜" 설명 (어떻게는 코드를 보면 알 수 있음)

### Footer (선택)

- `Refs: #123` — 관련 이슈
- `Closes: #123` — 이슈 종료
- `Breaking Change: ...` — 호환성 깨짐
- `Co-authored-by: ...` — 공동 작업자

### 예시

```
feat(auth): SMS OTP 검증 로직 추가

- 6자리 코드 생성 후 SMS 게이트웨이로 발송
- Redis에 3분 TTL로 저장
- 5회 실패 시 코드 무효화

Closes: #123
```

```
fix(relation): pending 상태 30일 만료 스케줄러 시간대 버그

스케줄러가 UTC 기준으로 실행되어 KST와 9시간 차이가 발생.
ZoneId.of("Asia/Seoul")로 명시.

Refs: #456
```

```
security(auth): JWT secret 키 환경변수 분리

하드코딩되어 있던 JWT secret을 환경변수로 이동.
기존 시크릿 회전 필요.

Breaking Change: JWT_SECRET 환경변수 필수
Closes: #789
```

---

## 5. 코드 스타일

### Java (Backend)

**기본 컨벤션**: Google Java Style Guide + 프로젝트 변형

**자동 포맷**:
```bash
./gradlew spotlessApply
```

**핵심 규칙**:
- 들여쓰기: 4 spaces (탭 금지)
- 줄 길이: 120자
- import: wildcard 금지
- final 적극 사용 (변수, 메서드, 클래스)
- Lombok 사용 가이드라인:
  - `@Data` 금지 (의도치 않은 setter 노출) → `@Getter @ToString @EqualsAndHashCode`
  - `@Builder` 사용 권장 (엔티티/DTO)
  - `@Slf4j` 사용 권장

**네이밍**:
- 클래스: PascalCase (`RelationService`)
- 메서드/변수: camelCase (`approveRelation`)
- 상수: UPPER_SNAKE_CASE (`MAX_RENEGOTIATION`)
- 패키지: lowercase (`com.chon.did.relation`)

**구조**:
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class RelationService {

    private final RelationRepository relationRepo;
    private final NotificationService notificationService;
    private final RelationStateMachine stateMachine;

    @Transactional
    public Relation requestRelation(Long fromUserId, Long toUserId, MatrixCoordinate coord) {
        // 1. 입력 검증
        validateRequest(fromUserId, toUserId, coord);

        // 2. 비즈니스 로직
        Relation relation = Relation.builder()
            .fromUserId(fromUserId)
            .toUserId(toUserId)
            .matrixCoordinate(coord)
            .status(RelationStatus.PENDING)
            .build();

        // 3. 영속화
        relation = relationRepo.save(relation);

        // 4. 부수 효과 (알림)
        notificationService.sendRelationRequest(relation);

        return relation;
    }

    // ...
}
```

### Dart/Flutter (Mobile)

**기본 컨벤션**: Effective Dart + Flutter Lints

**자동 포맷**:
```bash
dart format .
```

**핵심 규칙**:
- 들여쓰기: 2 spaces
- 줄 길이: 80자 (가능한 한)
- `const` 적극 사용
- 함수형 위젯(StatelessWidget) 우선, 필요 시 StatefulWidget

**네이밍**:
- 클래스: PascalCase
- 변수/함수: camelCase
- 상수: lowerCamelCase + const (`maxRetries`)
- 파일: snake_case (`relation_request_bloc.dart`)

**BLoC 구조 예시**:
```dart
// Event
abstract class RelationRequestEvent extends Equatable {
  const RelationRequestEvent();
  @override
  List<Object?> get props => [];
}

class SubmitRelationRequest extends RelationRequestEvent {
  final String toUserId;
  final MatrixCoordinate coordinate;

  const SubmitRelationRequest({required this.toUserId, required this.coordinate});

  @override
  List<Object?> get props => [toUserId, coordinate];
}

// State
abstract class RelationRequestState extends Equatable {
  const RelationRequestState();
}

class RelationRequestInitial extends RelationRequestState {
  @override
  List<Object?> get props => [];
}

class RelationRequestLoading extends RelationRequestState {
  @override
  List<Object?> get props => [];
}

// Bloc
class RelationRequestBloc extends Bloc<RelationRequestEvent, RelationRequestState> {
  final RelationRepository _repo;

  RelationRequestBloc(this._repo) : super(RelationRequestInitial()) {
    on<SubmitRelationRequest>(_onSubmit);
  }

  Future<void> _onSubmit(
    SubmitRelationRequest event,
    Emitter<RelationRequestState> emit,
  ) async {
    emit(RelationRequestLoading());
    try {
      final result = await _repo.requestRelation(event.toUserId, event.coordinate);
      emit(RelationRequestSubmitted(result));
    } catch (e) {
      emit(RelationRequestFailed(e.toString()));
    }
  }
}
```

### SQL

- 키워드 대문자 (`SELECT`, `FROM`, `WHERE`)
- 테이블/컬럼 snake_case (`group_members`, `user_id`)
- 인덱스 명명: `idx_<table>_<columns>` (`idx_relations_status_to_user`)
- 외래키 명명: `fk_<table>_<ref_table>` (`fk_relations_users`)
- 항상 마이그레이션 파일로 작성 (Flyway):
  ```
  V001__create_users_table.sql
  V002__create_relations_table.sql
  V003__add_phone_verified_to_users.sql
  ```

---

## 6. PR (Pull Request) 가이드

### PR 제목

커밋 메시지와 동일한 형식:
```
feat(auth): SMS OTP 검증 로직 추가
```

### PR 본문

[PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) 사용.

필수 섹션:
1. **변경 요약** (1-3줄)
2. **변경 이유** (어떤 이슈/요구사항)
3. **변경 사항** (체크리스트)
4. **테스트** (어떻게 검증했는지)
5. **스크린샷** (UI 변경 시)
6. **체크리스트**:
   - [ ] 자체 테스트 완료
   - [ ] 문서 업데이트 (DESIGN/TECH/ROADMAP 등 핵심 5개 문서 영향 시)
   - [ ] 사용자 영향 사항 PR 본문에 명시 (배포 노트용)
   - [ ] 보안 영향 검토
   - [ ] 성능 영향 검토

### PR 크기

- **이상적**: 200-400줄 변경
- **최대**: 600줄 (예외적, 미리 동의 필요)
- 큰 변경은 여러 PR로 분할

### Draft PR 활용

- 작업 중 코드는 Draft PR로 생성
- 일찍 피드백 받기 위해 활용
- 작업 완료 시 "Ready for review"로 전환

---

## 7. 리뷰 정책

### 리뷰어 수

| PR 종류 | 최소 승인 수 |
|---------|------------|
| feature/bugfix → develop | 1명 |
| release/* → main | 2명 (Tech Lead 포함) |
| hotfix/* → main | 2명 (즉시 검토) |
| 데이터베이스 마이그레이션 | + DBA |
| 보안 관련 | + Security Lead |
| API 변경 | + API Owner |

### 리뷰 SLA

| 우선순위 | 응답 시간 |
|---------|----------|
| 🔴 Critical (프로덕션 영향) | 1시간 |
| 🟠 High (Sprint blocker) | 4시간 |
| 🟡 Normal | 영업일 24시간 |
| 🟢 Low (문서, refactor) | 영업일 48시간 |

### 리뷰 체크리스트

리뷰어는 다음을 확인:

#### 기능
- [ ] 요구사항 충족
- [ ] Edge case 처리
- [ ] 에러 핸들링 적절

#### 코드 품질
- [ ] 가독성
- [ ] DRY 원칙
- [ ] 네이밍이 의도를 표현
- [ ] 주석은 "왜"를 설명 (코드는 "무엇을"을 설명)

#### 테스트
- [ ] 단위 테스트 존재
- [ ] 통합 테스트 (필요 시)
- [ ] 커버리지 유지

#### 보안
- [ ] 입력 검증
- [ ] 권한 체크
- [ ] PII 보호
- [ ] 하드코딩된 secret 없음

#### 성능
- [ ] N+1 쿼리 없음
- [ ] 적절한 인덱스 사용
- [ ] 캐시 활용 검토

### 리뷰 톤

- **사실 기반**: "이 코드는 N+1 쿼리를 발생시킨다" ✅
- **인격 공격 금지**: "왜 이렇게 짰냐" ❌
- **제안형 활용**: "이렇게 하면 어떨까?" ✅
- **칭찬도 적극**: 잘된 부분은 명시적으로 칭찬

---

## 8. 테스트 작성 가이드

**채택: 균형형 테스트 전략 (60% 단위 + 30% 통합 + 10% E2E)**

### 테스트 피라미드

```
        /\
       /E2E\         10% — 핵심 사용자 시나리오
      /─────\
     /통합   \       30% — DB, API, 외부 연동
    /─────────\
   /  단위     \    60% — 비즈니스 로직, 유틸
  /─────────────\
```

### 커버리지 목표

| 영역 | 최소 |
|------|------|
| Backend service | 80% |
| Backend controller | 70% |
| Mobile bloc | 70% |
| Mobile widget | 60% |
| 전체 | 75% |

### 단위 테스트 (Backend)

```java
@ExtendWith(MockitoExtension.class)
class RelationServiceTest {

    @Mock private RelationRepository relationRepo;
    @Mock private NotificationService notificationService;
    @InjectMocks private RelationService relationService;

    @Test
    @DisplayName("관계 요청 시 pending 상태로 저장되고 알림이 발송된다")
    void requestRelation_savesAsPendingAndSendsNotification() {
        // given
        Long fromUserId = 1L, toUserId = 2L;
        var coord = new MatrixCoordinate(1, 0);
        when(relationRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // when
        Relation result = relationService.requestRelation(fromUserId, toUserId, coord);

        // then
        assertThat(result.getStatus()).isEqualTo(RelationStatus.PENDING);
        verify(notificationService).sendRelationRequest(any());
    }
}
```

### 통합 테스트 (Testcontainers)

```java
@SpringBootTest
@Testcontainers
class RelationFlowIntegrationTest {

    @Container
    static MariaDBContainer<?> mariadb = new MariaDBContainer<>("mariadb:10.11");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
        .withExposedPorts(6379);

    @Test
    void fullMutualAuthFlow_succeeds() {
        // 가입 → 관계 요청 → 승인 → DID 발급 전체 흐름
    }
}
```

### Widget Test (Mobile)

```dart
testWidgets('RelationRequestScreen submits with valid input', (tester) async {
  final mockBloc = MockRelationRequestBloc();
  when(() => mockBloc.state).thenReturn(RelationRequestInitial());

  await tester.pumpWidget(
    MaterialApp(
      home: BlocProvider.value(value: mockBloc, child: RelationRequestScreen()),
    ),
  );

  await tester.enterText(find.byKey(Key('phoneInput')), '01012345678');
  await tester.tap(find.byKey(Key('submitButton')));

  verify(() => mockBloc.add(SubmitRelationRequest(toUserId: '...', coordinate: ...))).called(1);
});
```

---

## 9. 문서화

### 코드 주석

- **Public API**: JavaDoc / DartDoc 필수
- **복잡한 로직**: 인라인 주석으로 "왜"를 설명
- **TODO/FIXME**: 이슈 번호 첨부 (`// TODO(#123): 임시 처리, 별도 결정 후 개선`)

### 문서 업데이트

코드 변경 시 본 저장소의 핵심 5개 문서 중 해당 문서를 함께 업데이트:

| 코드 변경 | 업데이트 대상 |
|----------|-------------|
| 새 API 추가 | `backend/api/.../openapi.yaml` (단일 출처), PR 본문에 변경 요약 |
| 아키텍처 변경 | [DESIGN.md](DESIGN.md) |
| 의존성 추가/변경 | [TECH.md](TECH.md) §2-6 (스택 절) |
| 환경 변수 추가 | `.env.example`, README Quick Start |
| DB 스키마 변경 | [DESIGN.md](DESIGN.md) §5 + Flyway 마이그레이션 파일 |
| 보안 정책 변경 | [DESIGN.md](DESIGN.md) §16 보안 아키텍처 |
| Sprint 일정 변경 | [ROADMAP.md](ROADMAP.md) |
| 4단계 모델 (연동·확인·인증·누적) 영향 | [DESIGN.md](DESIGN.md) §6 + 권한 정책표 |
| 연결 채널 추가 / 정책 변경 | [DESIGN.md](DESIGN.md) §7 + [TECH.md](TECH.md) §1 스택표 |
| **관계 입력 / 출력 UI 변경** 🌱 | [DESIGN.md](DESIGN.md) §8 (입력) / §9 (출력 3-View) |
| **Trust Garden 단계 / 임계값 변경** 🌱 | [DESIGN.md](DESIGN.md) §6.7 + [TECH.md](TECH.md) §8 (D-25, D-28) |
| **Trust Level 정책 변경 (Lv1~Lv5)** 🎖️ | [DESIGN.md](DESIGN.md) §6.7 2-축 매트릭스 + [TECH.md](TECH.md) §8 (D-32, D-33, D-36) |
| **Reward Point 단가·신뢰 가중치 변경** 💎 | [DESIGN.md](DESIGN.md) §6.8 + [TECH.md](TECH.md) §8 (D-34, D-35) |
| **배지·NFT 신규 추가** 🏆 | [DESIGN.md](DESIGN.md) §6.9 + [TECH.md](TECH.md) §8 (D-38) |
| **노드 가시성·인원 정책 변경** | [DESIGN.md](DESIGN.md) §5 (Nodes 테이블) + [TECH.md](TECH.md) §8 (D-39, D-40) |
| **신고 처리 정책 변경** | [DESIGN.md](DESIGN.md) §5 (Reports 테이블) + [TECH.md](TECH.md) §8 (D-41) |
| **Trust Level (Lv1~Lv5) 정책 변경** 🆕 | [DESIGN.md](DESIGN.md) §6.8 + [TECH.md](TECH.md) §8 (D-32, D-33, D-36) |
| **Reward Point 정책 (Earn/Use/가중치) 변경** 🆕 | [DESIGN.md](DESIGN.md) §6.9 + [TECH.md](TECH.md) §8 (D-34, D-35, D-38) |
| **Badge / NFT 추가** 🆕 | [DESIGN.md](DESIGN.md) §6.10 + [TECH.md](TECH.md) §8 (D-40) + `mobile/assets/lottie/badges/*.json` |
| **신고 처리 정책** 🆕 | [DESIGN.md](DESIGN.md) §5 (Reports) + [TECH.md](TECH.md) §8 (D-39) |
| **노드 유형 / 가시성 추가** 🆕 | [DESIGN.md](DESIGN.md) §5 (Nodes) + [TECH.md](TECH.md) §8 (D-41, D-42) |
| **Ego-Centric Cypher 쿼리 변경** 🌱 | [DESIGN.md](DESIGN.md) §14.5 + `backend/.../cypher/*.cypher` |
| **Lottie 자산 교체** 🌱 | `mobile/assets/lottie/trust-garden/*.json` (디자이너 산출물) |
| 의사결정 항목 신규 | [TECH.md](TECH.md) §8 의사결정 매트릭스 + GitHub Issue `decision_required` 라벨 |

### 의사결정 기록 (Decision Log)

**언제 결정을 기록?**

다음에 해당하면 의사결정 항목으로 추적합니다:

- 시스템 아키텍처에 영향을 주는 결정
- 의존성을 추가/변경하는 결정
- 보안 정책 변경
- API 호환성 깨는 변경
- Sprint Blocker 해결책 선택

**기록 방법**:

1. **GitHub Issue + `decision_required` 라벨**로 추적 — 옵션·트레이드오프·권장값을 본문에 기재
2. 결정 확정 시 [TECH.md §8 의사결정 매트릭스](TECH.md) 표를 업데이트 (D-NN ID 부여)
3. 결정의 영향이 큰 항목은 [DESIGN.md](DESIGN.md) 본문에 직접 반영

**기록 형식 (Issue 본문 템플릿)**:

```markdown
## 결정 ID
D-NN

## 컨텍스트
(왜 결정이 필요한가)

## 옵션
- A: ...
- B: ...
- C: ...

## 권장 / 기본 가정
**A** — 근거: ...

## 결과 (긍정·부정 영향)
- ✅ ...
- ❌ ...

## 결정자 / 결정 기한
PM / 2026-05-31
```

---

## 10. 질문 및 도움 받기

### 채널

| 질문 종류 | 채널 |
|----------|------|
| 일반 질문 | Slack `#chon-dev` |
| 긴급 사고 | Slack `#chon-incident` + PagerDuty |
| 보안 취약점 | security@chon.ai (공개 채널 금지) |
| 의사결정 필요 | GitHub Issue + `decision_required` 라벨 |
| 코드 리뷰 요청 | PR 댓글 또는 Slack DM |

### 멘토링

신규 인원은 첫 2주간 멘토 1:1 연결.

### 사내 개발

본 프로젝트는 **CHON.INC 사내 전용**입니다 ([LICENSE](LICENSE) 참조). 외부 인원 컨트리뷰션은 별도 NDA 체결 후 가능합니다.

---

## 📚 관련 문서

본 프로젝트의 핵심 문서는 5개로 구성됩니다:

- [README.md](../README.md) — 프로젝트 개요 + Quick Start
- [DESIGN.md](DESIGN.md) — 시스템 설계 + 보안 아키텍처
- [TECH.md](TECH.md) — 기술 스택 + 의사결정 매트릭스
- [ROADMAP.md](ROADMAP.md) — Sprint 일정 + KPI
- [CONTRIBUTING.md](CONTRIBUTING.md) — (본 문서) 개발 워크플로우

> 라이선스: [LICENSE](LICENSE)
> 보안 신고: security@chon.ai

---

**최종 업데이트**: 2026-05-15
**문서 책임자**: Tech Lead
