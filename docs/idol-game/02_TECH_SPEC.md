# 「별이 되어줘 — 남자 아이돌 키우기」 기술 설계서

- 문서 버전: 1.0 (2026-09-04)
- 설계: Fable 5.1 / 구현: Opus 5
- 선행 문서: `01_GDD.md` (수치·규칙의 원본), `src/game/idol/types.ts` (타입 계약)

---

## 1. 스택과 제약

| 항목 | 결정 |
|---|---|
| 프레임워크 | 기존 저장소의 Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4 |
| 런타임 의존성 추가 | **금지**. 상태 관리 라이브러리, UI 킷, 애니메이션 라이브러리 모두 불필요 |
| 개발 의존성 추가 | `vitest`만 허용 (엔진 단위 테스트) |
| 기존 코드 | Design Revision Manager(`src/app/(login|register|dashboard|projects)`, `src/lib`, `src/app/api`)는 **수정 금지**. 게임은 완전히 독립된 모듈로 추가 |
| 폰트/외부 리소스 | 빌드·런타임에 네트워크 의존 없음 (시스템 폰트, 로컬 이미지) |
| 언어 | UI·데이터 텍스트 한국어. 코드 식별자 영어. 주석은 한국어 허용 |
| 브라우저 | 모바일 Safari/Chrome 최신, 데스크톱 Chrome |

이식성 원칙: 게임 관련 파일은 아래 4곳에만 존재해야 하며, 저장소의 다른 코드를 import하지 않는다. (나중에 별도 앱으로 분리할 때 폴더 4개만 옮기면 되도록.)

---

## 2. 폴더 구조

```
src/game/idol/                 # 순수 TypeScript. React/Next import 금지
  types.ts                     # ★ 타입 계약 (설계자 작성, 수정 금지)
  rng.ts                       # 시드 기반 난수 (mulberry32)
  balance.ts                   # 모든 상수 (BASE_GAIN, 비용, 임계값…) — GDD 수치의 단일 출처
  data/
    backgrounds.ts             # BackgroundDef[5]
    personalities.ts           # PersonalityDef[4]
    activities.ts              # ActivityDef[23]
    events.ts                  # GameEventDef[39] (E01~E33, E35~E40)
    endings.ts                 # EndingDef[15] (판정 순서대로 배열)
    dialogue.ts                # 월간 대사 풀
    concepts.ts                # 콘셉트 라벨/설명
  engine/
    index.ts                   # 공개 API (아래 4절) — UI는 이 파일만 import
    create.ts                  # createGame
    plan.ts                    # 계획 슬롯 조작, 활동 가용성
    resolve.ts                 # 주차 해결 (활동 적용, 팬 공식, 성장 공식)
    events.ts                  # 이벤트 판정/선택 적용
    month.ts                   # 월말 정산, 리포트, 페이즈 갱신, 자연 변동
    career.ts                  # 데뷔 평가, 컴백, 시상식
    endings.ts                 # 엔딩 판정
    selectors.ts               # getEmotion, getPortraitStage, 요약 계산
  save.ts                      # localStorage 저장/불러오기/도감 (브라우저 전용, 엔진과 분리)
  assets.ts                    # 이미지 경로 규약 + 폴백 정보
  __tests__/                   # vitest
src/app/idol/
  layout.tsx                   # 게임 셸 (다크 테마, viewport, 480px 컨테이너)
  page.tsx                     # 타이틀
  new/page.tsx                 # 캐릭터 생성
  play/page.tsx                # 메인 플레이 (상태 머신 렌더러)
  endings/page.tsx             # 엔딩 도감
src/components/idol/
  TopBar.tsx  Portrait.tsx  StatPanel.tsx  DialogueBox.tsx
  WeekPlanner.tsx  ActivityPicker.tsx  ResolveLog.tsx  EventModal.tsx
  MonthReport.tsx  DebutEvalScreen.tsx  ComebackPanel.tsx  AwardScreen.tsx
  EndingScreen.tsx  SaveMenu.tsx  GameImage.tsx  ui.tsx (Button, Card, Bar 등 소형 프리미티브)
public/idol/
  char/  bg/  cg/  ending/  ui/   # 03 문서의 파일명 규약. 없어도 동작해야 함
docs/idol-game/                # 이 문서들
```

---

## 3. 타입 계약

`src/game/idol/types.ts`가 유일한 진실이다. 엔진·데이터·UI 모두 여기서 타입을 import한다. 구현 중 필드가 부족하면 `GameState.flags`(문자열 키)를 사용하고, 타입 파일은 수정하지 않는다. 정말 계약 변경이 필요하면 설계자에게 보고한다.

플래그 키 규약(문자열):

| 키 | 값 | 설명 |
|---|---|---|
| `training_boost_until` | 월(number) | 해당 월까지 훈련 ×1.15 |
| `variety_regular_until` | 월 | 예능 고정 출연 기간 |
| `self_produced` | boolean | 다음 컴백 1회 자작곡 |
| `counsel_used_month` | 월 | 면담 월 1회 제한 |
| `first_music_show_done` | boolean | E17 |
| `rookie_award_checked` | boolean | 신인상은 데뷔 후 첫 시상식만 |

---

## 4. 엔진 공개 API (`src/game/idol/engine/index.ts`)

모든 함수는 **순수 함수**: 입력 상태를 변경하지 않고 새 상태를 반환한다(구조적 복사, `structuredClone` 사용 가능). 난수는 `state.rngState`에서만 꺼내 쓰고 갱신된 값을 새 상태에 넣는다 → 같은 시드·같은 입력이면 항상 같은 결과.

```ts
// 생성
export function createGame(config: NewGameConfig): GameState;

// 계획 (phase === 'planning')
export function setPlanSlot(state: GameState, weekIndex: 0|1|2|3, activityId: ActivityId | null): GameState;
export function fillPlan(state: GameState, activityId: ActivityId): GameState;         // 4칸 모두 채움
export function getAvailableActivities(state: GameState): Array<{ def: ActivityDef; available: boolean; reason?: string }>;
export function getPlanPreview(state: GameState): { money: number; stamina: number; stress: number; valid: boolean; problems: string[] };
export function upgradeTrainer(state: GameState): GameState;                           // 자금 부족/최대 등급이면 원본 반환
export function canRequestDebutEval(state: GameState): { ok: boolean; reason?: string };
export function requestDebutEval(state: GameState): GameState;                         // phase → 'debut_eval', ui.lastDebutEval 설정
export function confirmDebutEval(state: GameState): GameState;                         // → 'planning'

// 실행
export function startMonth(state: GameState): GameState;   // 계획 검증 후 phase → 'resolving', weekIndex 0
export function step(state: GameState): GameState;         // 한 주 해결. 이벤트 발생 시 phase → 'event'. 4주 완료 시 월말 처리 후 phase → 'report'
export function chooseOption(state: GameState, choiceId: string): GameState; // phase 'event' → 효과 적용 → 'resolving' (엔딩이면 'ended')
export function confirmReport(state: GameState): GameState; // 'report' → 다음 달 'planning' | 'comeback' | 'award' | 'ended'

// 커리어
export function chooseComeback(state: GameState, concept: ConceptId, focus: ComebackFocus): GameState; // 결과 계산, ui.lastComeback 설정 (phase 유지)
export function confirmComeback(state: GameState): GameState; // → 'award'(해당 월이 시상식이면) | 'planning'
export function confirmAward(state: GameState): GameState;    // → 'ended'(36개월차) | 'planning'

// 조회
export function getEmotion(state: GameState): Emotion;
export function getPortraitStage(state: GameState): PortraitStage;
export function getCoreAverage(state: GameState): number;
export function getCurrentEvent(state: GameState): GameEventDef | null;
export function getEndingDef(id: EndingId): EndingDef;
export function getIdolLine(state: GameState): string;     // 월 계획 화면용 대사 (rng 소비 없이 month·mood로 결정적 선택)
```

### 4.1 상태 머신

```
planning ──startMonth──▶ resolving ──step(×4)──▶ report ──confirmReport──▶ planning(다음 달)
   │                        │  ▲                                  │
   │ requestDebutEval       │  └─ chooseOption ◀── event ◀─ step   ├─▶ comeback ──chooseComeback→confirmComeback─▶ award | planning
   ▼                        │                                     ├─▶ award ──confirmAward─▶ planning | ended
debut_eval ─confirmDebutEval┘                                     └─▶ ended
```

우선순위(confirmReport 시): 조기 엔딩 > 36개월차 종료 처리(시상식 → 엔딩) > 시상식(12/24) > 컴백 달 > 계약 종료(24개월차 미데뷔) > planning.
- 36개월차: report → (데뷔 시) award → ended. 컴백이 36개월차에 잡혀 있으면 planning 전에 이미 처리되었으므로 무시.
- 컴백은 "그 달의 planning 진입 전"에 처리: `confirmReport`가 다음 달로 넘길 때 `nextComebackMonth === 다음 달`이면 phase를 `comeback`으로.

### 4.2 주차 해결 알고리즘 (`step`)

```
1. weekIndex = ui.weekIndex, activity = plan[weekIndex]
2. 체력 자연 회복 +5 (최대 체력 상한)
3. 활동 적용 (resolve.ts):
   a. 비용 차감/수입 가산 (버스킹 팁은 rng)
   b. 체력/스트레스 변화 (성격 배수, 부상 배수)
   c. 성장 공식 (GDD 6절) → skills 갱신, maxStamina 갱신
   d. 팬 공식 (GDD 5.1절)
   e. 호감도/평판 고정 증감
   f. 로그 1줄 push ("2주차: 보컬 레슨 — 보컬 +3.2, 체력 −15, 스트레스 +6")
4. 위기 규칙: 체력 ≤ 0 → E32 강제; 스트레스 ≥ 100 → E31 강제 (둘 다면 E32 먼저, 다음 step에서 E31)
5. 일반 이벤트 판정 (events.ts, GDD 9.1) — 이번 달 이벤트 수 < 2일 때만 (강제 이벤트는 예외)
6. 이벤트 발생 → ui.pendingEventId 설정, phase 'event', weekIndex는 그대로(선택 후 다음 주로 넘어감)
   발생 없음 → weekIndex + 1
7. weekIndex === 4 → 월말 처리 (month.ts): 고정 정산, 팬 자연 변동, 예능 고정/가불/지원 삭감 카운터, 부상 자연 회복, 페이즈 갱신,
   E33 판정(월말 이벤트, 있으면 phase 'event'이고 chooseOption 후 report로), 리포트 작성 → phase 'report'
```

`chooseOption` 후: 효과 적용 → 엔딩 지정 선택지면 `ending` 설정·phase 'ended' → 아니면 weekIndex +1 (월말 이벤트였다면 report로).

### 4.3 이벤트 판정 (`events.ts`)
```
candidates = EVENTS.filter(e =>
   trigger.kind 별 조건 && requirement(when) && once/cooldown && (activityId/activityCategory 매칭))
fixed_month: month === trigger.month && weekIndex === 0 (한 달에 여러 fixed면 priority 순, 나머지는 다음 주로 이월)
conditional/random: chance 롤 (rng < chance × personality.scandalMul(스캔들류만))
여러 개 통과 시 priority 내림차순 → 동률이면 rng
```
`seenEvents[id] = { count, lastMonth }` 갱신.

### 4.4 성장·팬·경제 수치
전부 `balance.ts` 상수로 두고 GDD 표를 그대로 옮긴다. 매직 넘버를 엔진 코드에 직접 쓰지 않는다.

### 4.5 난수 (`rng.ts`)
```ts
export function nextRandom(state: number): { value: number; next: number }; // mulberry32, value ∈ [0,1)
export function randRange(state, min, max)  // 정수/실수 헬퍼
```
시드는 `createGame`에서 `config.seed ?? Date.now()`.

---

## 5. 저장 (`save.ts`)

| 키 | 내용 |
|---|---|
| `idolboy.autosave` | `SaveFile` — `confirmReport`, `chooseOption`, `confirmComeback`, `confirmAward` 직후 UI가 자동 저장. 난수 결과가 확정되는 `requestDebutEval`, `confirmDebutEval`, `chooseComeback`, `upgradeTrainer` 직후에도 저장한다 (새로고침으로 점수를 다시 뽑는 세이브 스커밍 방지) |
| `idolboy.slot.1` ~ `idolboy.slot.3` | 수동 저장 |
| `idolboy.endings` | `EndingGalleryEntry[]` (중복 id는 최신 날짜만) |
| `idolboy.settings` | `{ speed: 'normal' | 'fast' }` |

- 모든 접근은 try/catch (프라이빗 모드, SSR에서 `window` 없음).
- `SaveFile.version !== GAME_VERSION`이면 불러오기 거부 + 안내. 마이그레이션은 v2부터.
- 슬롯 메타(요약)는 저장 파일에서 파생: 이름, 월, 페이즈, 팬, 저장 시각.

---

## 6. UI 설계

### 6.1 원칙
- `play/page.tsx`는 **얇은 렌더러**: `useState<GameState>` 하나 + `useReducer` 없이 엔진 함수를 호출해 상태 교체. 게임 규칙을 컴포넌트에서 계산하지 않는다.
- 각 phase마다 렌더할 패널을 스위치로 고른다. 모달(EventModal, ActivityPicker, SaveMenu)은 오버레이.
- `"use client"`는 페이지·컴포넌트 전부. 서버 컴포넌트 없음(엔진은 클라이언트에서만 실행).
- 첫 렌더 전 `localStorage` 읽기는 `useEffect` 안에서 (hydration 불일치 방지). 자동 저장이 없으면 `/idol`로 리다이렉트.

### 6.2 컴포넌트 계약 (요약)

| 컴포넌트 | props | 역할 |
|---|---|---|
| `TopBar` | state, onOpenMenu | 년차/월, 페이즈 배지, 자금, 팬(축약 표기 1.2만/35.0만/120만) |
| `Portrait` | stage, emotion, name, size | `GameImage`로 `/idol/char/{stage}_{emotion}.png` 시도, 폴백은 그라데이션+이니셜+감정 이모지 |
| `StatPanel` | idol, compact? | 6 능력치 바 + 체력/스트레스/호감도/평판. 스트레스 ≥ 70 붉은색, 체력 < 30 주황 |
| `DialogueBox` | text, speaker | 말풍선 |
| `WeekPlanner` | plan, activities, onPick(slot), preview | 4슬롯 + 예상 지출/체력 + "모두 같은 활동" 버튼 |
| `ActivityPicker` | list(getAvailableActivities), onSelect, onClose | 하단 시트, 분류 탭, 불가 사유 표시 |
| `ResolveLog` | log, visibleCount, weekIndex, speed, onToggleSpeed, done | 표시 전용. 로그 공개 타이머와 step 호출 루프는 `play/page.tsx`가 단독 소유한다 (StrictMode 이중 실행으로 한 틱에 두 주가 진행되는 것을 방지) |
| `EventModal` | event, state, onChoose | 배경/CG/포트레이트 + 본문 + 선택지(조건부 힌트 표시) |
| `MonthReport` | report, onNext | 전후 비교, 수입/지출, 대사 |
| `DebutEvalScreen` | result, onConfirm | 점수 연출, 통과/실패 |
| `ComebackPanel` | state, onChoose, onConfirm | 콘셉트 5카드(라벨·설명), 포커스 3버튼, 결과 뷰 |
| `AwardScreen` | awards, onConfirm | 수상 연출 |
| `EndingScreen` | ending, state, onTitle, onGallery | 일러스트 + 에필로그 + 요약 |
| `SaveMenu` | state, onLoad, onClose | 슬롯 3개 저장/불러오기/삭제, 타이틀로, 속도 설정 |
| `GameImage` | src, alt, fallback(ReactNode), className | `<img>` onError 시 폴백 렌더. 로드 성공 전에도 폴백을 깔아 레이아웃 흔들림 방지 |

### 6.3 레이아웃
- `layout.tsx`: `<div className="min-h-screen bg-[#0B1020] text-[#EEF0FF]"><div className="mx-auto max-w-[480px] min-h-screen flex flex-col">…`
- 데스크톱에서는 가운데 480px 기둥 + 양옆 어두운 배경. 가로 스크롤 금지.
- 터치 타깃 최소 44px. 버튼 프리미티브는 `ui.tsx`에 모아 스타일 일관성 유지.

### 6.4 연출
- 로그는 300ms 간격(빠르게 모드 80ms). 스탯 변화 숫자는 증가 민트/감소 붉은색.
- 팬 수 표기: < 1만 → "3,200", 1만 이상 → "1.2만", 1억 이상 → "1.0억".
- 이모지 아이콘 매핑은 `activities.ts`의 `icon` 필드.

---

## 7. 에셋 규약 (`assets.ts`)

```ts
portraitSrc(stage, emotion) → `/idol/char/${stage}_${emotion}.png`
bgSrc(id)                   → `/idol/bg/${id}.png`
cgSrc(id)                   → `/idol/cg/${id}.png`
endingSrc(id)               → `/idol/ending/${id}.png`
titleSrc()                  → `/idol/ui/title_key_visual.png`
logoSrc()                   → `/idol/ui/logo.png`
```
파일이 없으면 `GameImage`가 폴백을 그린다. 이미지 존재 여부를 빌드 시점에 검사하지 않는다(사용자가 나중에 파일만 넣으면 즉시 반영).

---

## 8. 테스트 계획 (`vitest`)

`vitest.config.ts`에 `@` → `src` alias 설정. 테스트는 엔진만 대상(React 없음).

| 파일 | 케이스 |
|---|---|
| `rng.test.ts` | 같은 시드 → 같은 수열, 범위 [0,1) |
| `create.test.ts` | 출신별 초기 스탯/재능/팬/자금이 GDD 표와 일치, 성격 저장, phase 'planning', 36개월 상수 |
| `resolve.test.ts` | 레슨 1주: 해당 능력치 증가·자금 차감·체력/스트레스 변화; 휴식: 체력 +40 스트레스 −15; 자금 부족 활동은 `getAvailableActivities`에서 불가; 재능/트레이너 배수가 gain에 반영; dim 감쇠(90에서의 gain < 20에서의 gain); 체력 <30 시 ×0.5 |
| `events.test.ts` | fixed_month 이벤트가 정확한 달 1주차에 발생; once 이벤트 재발 없음; cooldown 준수; 체력 0 → E32 강제; 스트레스 100 → E31 강제, 호감도에 따른 분기; 월 최대 2개 |
| `month.test.ts` | 연습생 정산 +40−20; 데뷔 후 팬 수익 공식; promo 없으면 팬 −3%; 페이즈 전환 임계값; 부상 2개월 자연 회복 |
| `career.test.ts` | 데뷔 평가 신청 조건; 통과 시 debuted/팬 증가/nextComebackMonth; 실패 시 failures 증가·2개월 재신청 제한; 컴백 점수→순위 매핑 4구간; 콘셉트 적성 배수; 시상식 4종 조건; 24개월차 미데뷔 → contract_terminated |
| `endings.test.ts` | 15개 엔딩 각각 조건을 만족하는 상태를 만들어 판정 순서 확인(특히 partner_secret > world_star, top_idol > actor) |
| `save.test.ts` | serialize → deserialize 왕복 동일; 버전 불일치 거부 (localStorage mock) |
| `determinism.test.ts` | 같은 시드·같은 계획으로 12개월 자동 진행 두 번 → 최종 상태 deep-equal |
| `simulation.test.ts` | GDD 14절 시나리오 3개를 자동 플레이로 재현 (알바만 → 계약 종료, 훈련만 → 위기 이벤트, 보컬 몰빵 → 36개월차 보컬 ≥ 85) |

---

## 9. 검증 커맨드와 완료 기준

```bash
npx tsc --noEmit          # 타입 오류 0
npm test                  # vitest 전부 통과 ("test": "vitest run" 스크립트 추가)
npm run build             # Next 빌드 성공 (기존 페이지 포함)
```
추가로 `npm run dev` 후 Playwright(사전 설치된 Chromium)로 `/idol` → 새 게임 → 1개월 진행 → 리포트까지 스모크 스크린샷을 남긴다(`docs/idol-game/screenshots/`).

완료 기준:
1. 위 3개 커맨드 통과.
2. 이미지 파일이 하나도 없는 상태에서 타이틀 → 캐릭터 생성 → 36개월 완주 → 엔딩 → 도감까지 브라우저에서 막힘 없이 진행.
3. GDD의 활동 23개, 이벤트 39개, 엔딩 15개가 데이터 파일에 전부 존재하고 id가 `types.ts`의 union과 일치.
4. 기존 Design Revision Manager 코드 diff 없음.

---

## 10. 구현 순서 (Opus 작업 지시)

### Step 1 — 엔진과 데이터 (React 없음)
1. `vitest` devDependency 추가, `vitest.config.ts`, `package.json`에 `"test": "vitest run"`.
2. `rng.ts`, `balance.ts`, `data/*` (GDD 표 그대로 옮김; 이벤트 본문·선택지 문구·대사는 GDD 톤에 맞춰 한국어로 작성).
3. `engine/*` 전부, `save.ts`, `assets.ts`.
4. `__tests__/*` 8절 전부. `npx tsc --noEmit && npm test` 통과.

### Step 2 — UI
1. `src/app/idol/layout.tsx`, 4개 페이지, `src/components/idol/*`.
2. 이미지 없이 완주 가능한지 Playwright 스모크로 확인, 스크린샷 저장.
3. `npm run build` 통과.

각 Step 끝에 변경 파일 목록과 검증 결과를 보고한다.

---

## 11. 코딩 규칙
- 엔진: 클래스 없이 순수 함수 + 불변 데이터. `any` 금지. 모든 GDD 수치는 `balance.ts`.
- 데이터 파일은 `satisfies` 로 타입 검증 (`export const ACTIVITIES = [...] satisfies ActivityDef[]`) 후 id 유일성·개수 테스트.
- UI 컴포넌트는 props로만 데이터를 받고 엔진 함수는 `play/page.tsx`에서만 호출한다(예외: 조회 함수 `getEmotion` 등은 컴포넌트에서 호출 가능).
- 텍스트에 이모지는 활동 아이콘·스탯 아이콘에만. 서사 텍스트에는 금지.
- 커밋 메시지는 `feat(idol): …` 접두어.
