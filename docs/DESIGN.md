# CHON 디자인 시스템 명세 v7

> **버전**: v7 — 3-way 토글 패턴 + 그래프 시각화 + 인증현황 통합
> **날짜**: 2026년 5월
> **범위**: UX/UI 디자인 원칙, 컴포넌트 패턴, 인터랙션 흐름

---

## 1. 핵심 원칙

### 1.1 관계가 곧 신원
CHON의 핵심 메시지: **"관계가 곧 신원입니다 / Relationship is the Identity"**

모든 UI는 이 원칙을 시각적으로 표현해야 한다:
- 개인을 고립된 요소로 표현하지 않음
- 항상 관계(엣지/박스 포함)와 함께 표시
- 인증 상태를 시각적으로 분리해 신뢰 가시화

### 1.2 박스 포함 디자인 (Box Containment)
선이 얽힌 트리 대신 **박스로 가족을 감싸는 시각화**:
- 한 가족 = 한 박스
- 박스 중첩 깊이로 세대 표현
- 모바일에서 선 교차 없이 자연스러운 세로 스크롤

### 1.3 출생 순서 좌→우 정렬
모든 형제자매는 출생 순서로 좌측에서 우측으로 정렬:
- 첫째 → 둘째 → 셋째 ...
- 박스 내부에서도, 그래프에서도 동일

### 1.4 부계 중심 + 외부 결혼자 시점 전환
- 기본 시점: 부계 혈통 중심
- 외부 결혼자(어머니, 형수 등)는 🔀 표시
- 클릭 시 해당 인물의 가계도로 시점 전환 (perspective stack)

---

## 2. 3-Way 토글 패턴 (정식 명세)

### 2.1 구조

모든 관계도 입력 도구는 **3-way 토글**을 사용한다:

```
┌──────────────────────────────────────┐
│ [좌측: 시각화] [가운데: 입력] [우측: 인증현황] │
│  ─────────────                       │
│  (디폴트 active)                      │
└──────────────────────────────────────┘
```

### 2.2 각 탭의 역할

#### 좌측 — 결과 시각화 (디폴트 active)
- **그래프(SVG) 기반 시각화**
- 노드-엣지로 관계 명시화
- 단일 클릭: 액션 패널
- 더블클릭: 입력 탭(가운데)으로 점프
- 라벨 예시: 🌳 가계도, 🏫 학급증, 🌐 친구

#### 가운데 — 입력
- **박스 포함 디자인**
- 빈 슬롯(+) 탭으로 새 구성원 추가
- 기존 노드 탭으로 액션 패널
- 시점 전환, 결혼, 자녀 추가 등 본격적 편집
- 라벨: ➕ 추가하기 (모든 도구 공통)

#### 우측 — 인증현황
- **세대별/역할별 인증 상태 리스트**
- 상단에 인증 카운트 카드 (전체/✓인증/⏱미인증)
- 미인증 항목에 빠른 인증 버튼
- 항목 클릭 시 입력 탭으로 점프
- 라벨: ✓ 인증현황 (모든 도구 공통)

### 2.3 토글 디자인 토큰

```css
.view-toggle {
  display: flex;
  gap: 4px;
  padding: 0 16px 12px;
}
.view-toggle-btn {
  flex: 1;
  padding: 9px 6px;
  font-size: 12px;
  font-weight: 800;
  border: 1.5px solid #E2E8F0;
  border-radius: var(--radius-md);
}
.view-toggle-btn.active {
  background: var(--primary-color);  /* 도구별 색상 */
  color: white;
}
```

각 도구별 `--primary-color`:
- 가계도: `--chon-orange` (#F7931E)
- 학급증: `--school-blue` (#2563EB)

---

## 3. 인증현황 카드 패턴

### 3.1 구조

인증현황 탭 최상단에 3개 카운트 카드:

```
┌─────────────────────────────────────┐
│ [전체 N명]  [✓ 인증 M명]  [⏱ 미인증 K명] │
└─────────────────────────────────────┘
```

### 3.2 시각 차별화

| 카드 | 배경 | 테두리 | 숫자 색상 |
|------|------|-------|---------|
| 전체 | white | gray | text-primary |
| ✓ 인증 | green-tint 6% | green 40% | status-confirmed |
| ⏱ 미인증 | amber-tint 6% | amber 40% | status-pending |

### 3.3 빠른 인증 버튼

미인증 항목 우측에 즉시 인증 버튼:

```html
<button class="verify-quick-btn" onclick="quickConfirmList(id)">✓ 인증</button>
```

- 클릭 시 즉시 인증 + 카드 자동 갱신
- 라벨 클릭으로 입력 탭 점프와 별도 (event.stopPropagation)

### 3.4 CSS

```css
.verify-summary {
  display: flex;
  gap: 8px;
  padding: 12px 16px 16px;
}
.verify-stat-card {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  border-radius: var(--radius-md);
}
.verify-stat-value {
  font-size: 22px;
  font-weight: 900;
}
.verify-stat-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-top: 6px;
}
```

---

## 4. 그래프 시각화 패턴

### 4.1 SVG 그래프 구조

```html
<svg viewBox="0 0 W H" preserveAspectRatio="xMidYMid meet">
  <g id="graphEdges"></g>  <!-- 엣지 먼저 (아래) -->
  <g id="graphNodes"></g>  <!-- 노드 위 -->
</svg>
```

### 4.2 노드 디자인

```javascript
const w = 50, h = 26;  // 가계도: 작게
const w = 60, h = 28;  // 학급증: 약간 크게
```

- `rx: 6` (둥근 사각형)
- 미인증: `stroke-dasharray="3 2"` (점선)
- 본인(self): `me-glow` 클래스 (오렌지 글로우)
- 외부 결혼자: 보라 점선 테두리

### 4.3 엣지 색상

| 상태 | 색상 | 두께 | 스타일 |
|------|------|------|--------|
| 인증된 혈연 | `#10B981` (green) | 2px | 실선 |
| 대기 중 | `#F59E0B` (amber) | 1.5px | 점선 (4 3) |
| 외부 결혼자 | `#8B5CF6` (purple) | 1.5px | 점선 (4 3) |
| Admin(권한수령형) | `#7C3AED` | 1px | 점선 (2 4), opacity 0.35 |

### 4.4 세대별 수직 배치 (가계도)

```javascript
const yGen = {
  grandparents: 60,
  parents: 180,
  siblings: 320,
  children: 460
};
```

좌측에 세대 라벨 (`.graph-tier-label`) 표시.

### 4.5 부채꼴 배치 (학급증)

친구들은 나(중심) 아래에 부채꼴로:

```javascript
const spread = Math.min(W - 80, cmCount * 60);
classmates.forEach((p, i) => {
  positions[p.id] = {
    x: startX + (i / (cmCount - 1)) * spread,
    y: lowerY + (i % 2 === 0 ? 0 : 30)  // 지그재그
  };
});
```

---

## 5. 그래프 노드 인터랙션

### 5.1 단일 클릭 vs 더블클릭

```javascript
let clickTimer = null;
grp.addEventListener('click', (e) => {
  if (clickTimer) return;
  clickTimer = setTimeout(() => {
    clickTimer = null;
    showGraphActionPanel(id, e);  // 단일 클릭
  }, 250);
});
grp.addEventListener('dblclick', (e) => {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
  switchView('tree');  // 더블클릭
});
```

### 5.2 액션 패널 메뉴

그래프 노드 단일 클릭 시 표시:
- `🔀 시점으로` (외부 결혼자만)
- `✓ 인증` / `⏱ 대기로`
- `➕ 추가하기 탭` (입력으로 점프)
- `🗑 삭제` (본인 제외)

가계도 v13 / 학급증 v4 양쪽 동일한 패턴.

### 5.3 패널 위치 계산

```javascript
const wrapRect = wrap.getBoundingClientRect();
const targetRect = evt.target.getBoundingClientRect();
const x = targetRect.left + targetRect.width / 2 - wrapRect.left;
const y = targetRect.bottom - wrapRect.top + 12;
panel.style.left = `${x - 75}px`;
panel.style.top = `${y}px`;
```

### 5.4 빈 영역 클릭 시 닫기

```javascript
document.getElementById('graphSvg').addEventListener('click', e => {
  if (e.target.tagName === 'svg' ||
      e.target.id === 'graphEdges' ||
      e.target.id === 'graphNodes') {
    closeGraphPanel();
  }
});
```

---

## 6. 두 도구 통합 패턴

### 6.1 통합 페이지 구조

```
┌──────────────────────────────────────┐
│ 로고  CHON 관계도 통합               │
├──────────────────────────────────────┤
│  [🌳 가계도]  [🏫 학급증]            │ ← 메인 탭
│   ─────────                          │
├──────────────────────────────────────┤
│                                      │
│         [iframe: 선택된 도구]        │
│                                      │
└──────────────────────────────────────┘
```

### 6.2 메인 탭 디자인

```css
.main-tab {
  padding: 12px 28px;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 800;
}
.main-tab[data-tool="family_tree"].active {
  background: var(--chon-orange);
}
.main-tab[data-tool="class_id"].active {
  background: var(--school-blue);
}
```

→ 도구별 컬러로 active 상태 차별화

### 6.3 iframe 통합

각 도구를 독립 HTML 파일로 유지하고 iframe으로 임베드:
- 코드 중복 최소화
- 각 도구는 독립적으로도 사용 가능
- 상태가 도구 간 분리됨 (의도된 격리)

---

## 7. 4가지 토폴로지 (참고)

CHON 관계 시각화 도구의 4가지 토폴로지:

| 번호 | 토폴로지 | 권한 구조 | 디자인 |
|------|---------|---------|------|
| 01 | 🌳 가계도 | 내가 중심 | 세대별 박스 중첩 |
| 02 | 🌐 일반 네트워크 | 내가 중심 | 친구(1-hop) + 친구의 친구(2-hop) |
| 03 | ⭐ 계층적 수직 (학교) | 내가 중심 | 위계 협력(담임-학부모) + 또래(친구들) |
| 04 | 🏢 권한수령형 (조직) | 조직 → 내 동의 | 👑 Admin + 계층적 위계 |

상세 명세: `frontend/views/graph-tool.html` 참조.

---

## 8. 색상 토큰

### 8.1 브랜드
```
--chon-orange: #F7931E       /* 가계도 primary */
--chon-orange-dark: #E87F0A
--chon-yellow: #FCD34D
--chon-yellow-soft: #FFF3D6
--school-blue: #2563EB        /* 학급증 primary */
```

### 8.2 노드 (가족)
```
--node-male: #DBEAFE         /* 남성 배경 */
--node-male-border: #6FA8DC
--node-female: #FCE7F3       /* 여성 배경 */
--node-female-border: #E89BAA
--node-self-border: #F7931E  /* 본인 강조 */
```

### 8.3 노드 (학급)
```
--teacher-bg: #FEE2E2        /* 담임 */
--teacher-color: #DC2626
--parent-bg: #D1FAE5         /* 학부모 */
--parent-color: #059669
--student-bg: #DBEAFE        /* 학생 */
--student-color: #2563EB
```

### 8.4 상태
```
--status-confirmed: #10B981  /* ✓ 인증됨 */
--status-pending: #F59E0B    /* ⏱ 대기 */
--drill-color: #8B5CF6       /* 🔀 외부 결혼자 */
```

---

## 9. 그림자 & 라운드

```
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06)
--shadow-md: 0 4px 14px rgba(0,0,0,0.08)
--shadow-lg: 0 10px 30px rgba(0,0,0,0.14)

--radius-sm: 8px
--radius-md: 14px
--radius-lg: 20px
--radius-pill: 999px
```

---

## 10. 변경 이력

- **v7** (2026-05): 3-way 토글 패턴 정식화, 그래프 시각화 통합, 인증현황 카드, 두 도구 통합 페이지
- **v6**: §6.8 GraphTopology + §6.9 SecLev 추가
- **v5 이전**: 가계도 UX 중심 (v11 박스 포함 디자인 확립)

---

## 11. 파일 자산 매트릭스

### 시각화 도구
| 파일 | 내용 |
|------|------|
| `frontend/views/family-tree.html` | 가계도 — 3-way 토글, 그래프 액션 패널, 인증현황 카드 |
| `frontend/views/class-id.html` | 학급증 — 3-way 토글, 그래프 액션 패널, 인증현황 카드 |
| `frontend/main/contact.html` | 통합 페이지 (iframe 기반) |
| `frontend/views/graph-tool.html` | 4 토폴로지 시각화 (Admin 포함) |

### 시스템 문서 (v7)
| 파일 | 내용 |
|------|------|
| `CHON_System_Architecture_v7.md` | PDF 기반 전체 시스템 흐름 |
| `TECH.md` | API · 데이터 모델 · 보안 |
| `ROADMAP.md` | 출시 현황 + 향후 작업 |

---

**문서 끝**
