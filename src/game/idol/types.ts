/**
 * 「별이 되어줘 — 남자 아이돌 키우기」 도메인 타입 계약
 *
 * 이 파일은 엔진(src/game/idol/engine), 데이터(src/game/idol/data), UI(src/app/idol, src/components/idol)가
 * 공유하는 유일한 계약이다. 설계자(Fable 5.1)가 작성했으며 구현 에이전트는 이 파일을 수정하지 않는다.
 * 필드가 부족하면 GameState.flags(문자열 키)를 사용한다. 수치의 원본은 docs/idol-game/01_GDD.md.
 */

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

export const GAME_VERSION = 1 as const;
export const TOTAL_MONTHS = 36 as const;
export const WEEKS_PER_MONTH = 4 as const;
export const START_AGE = 18 as const;

// ---------------------------------------------------------------------------
// 능력치
// ---------------------------------------------------------------------------

export const SKILL_IDS = ["vocal", "dance", "rap", "visual", "variety", "acting"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/** 데뷔 평가·컴백 평균에 쓰는 코어 5종 (연기 제외) */
export const CORE_SKILL_IDS = ["vocal", "dance", "rap", "visual", "variety"] as const;
export type CoreSkillId = (typeof CORE_SKILL_IDS)[number];

export const SKILL_LABELS: Record<SkillId, string> = {
  vocal: "보컬",
  dance: "댄스",
  rap: "랩",
  visual: "비주얼",
  variety: "예능감",
  acting: "연기",
};

export type Skills = Record<SkillId, number>;

// ---------------------------------------------------------------------------
// 출신 · 성격 · 콘셉트
// ---------------------------------------------------------------------------

export const BACKGROUND_IDS = [
  "street_cast",
  "dance_academy",
  "vocal_prodigy",
  "underground_rapper",
  "child_actor",
] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export const PERSONALITY_IDS = ["diligent", "free_spirit", "perfectionist", "optimist"] as const;
export type PersonalityId = (typeof PERSONALITY_IDS)[number];

export const CONCEPT_IDS = ["fresh", "sexy", "hiphop", "ballad", "performance"] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];

export const CONCEPT_LABELS: Record<ConceptId, string> = {
  fresh: "청량",
  sexy: "섹시",
  hiphop: "힙합",
  ballad: "발라드",
  performance: "퍼포먼스",
};

/** 컴백 타이틀곡 포커스 */
export type ComebackFocus = "vocal" | "dance" | "rap";

export type TrainerTier = 1 | 2 | 3;

export type CareerPhase = "trainee" | "rookie" | "rising" | "star";

export const CAREER_PHASE_LABELS: Record<CareerPhase, string> = {
  trainee: "연습생",
  rookie: "신인",
  rising: "라이징 스타",
  star: "톱스타",
};

export type ActivityCategory = "training" | "work" | "promo" | "rest";

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  training: "훈련",
  work: "알바·활동",
  promo: "홍보",
  rest: "휴식",
};

export type Emotion = "neutral" | "happy" | "tired" | "sad" | "excited" | "determined";

export type PortraitStage = "trainee" | "rookie" | "star";

export type Mood = "stressed" | "tired" | "bonded" | "happy" | "neutral";

// ---------------------------------------------------------------------------
// 정의 데이터 (data/*.ts)
// ---------------------------------------------------------------------------

export interface BackgroundDef {
  id: BackgroundId;
  label: string;
  description: string;
  skills: Skills;
  talents: Record<SkillId, number>;
  conceptAffinity: Record<ConceptId, number>;
  startFans: number;
  startMoney: number;
  startStress: number;
  startBond: number;
  startReputation: number;
  maxStamina: number;
}

export interface PersonalityDef {
  id: PersonalityId;
  label: string;
  description: string;
  trainingMul: number;
  /** 스트레스 증가량 배수 */
  stressMul: number;
  /** 휴식류 활동의 회복량(체력·스트레스 감소) 배수 */
  restMul: number;
  fansMul: number;
  bondMul: number;
  /** 스캔들·루머·열애설류 이벤트 확률 배수 */
  scandalMul: number;
  conceptBonus: Partial<Record<ConceptId, number>>;
}

export const ACTIVITY_IDS = [
  "lesson_vocal",
  "lesson_dance",
  "lesson_rap",
  "lesson_acting",
  "lesson_variety",
  "styling",
  "fitness",
  "practice_vocal",
  "practice_dance",
  "practice_rap",
  "job_convenience",
  "job_cafe",
  "job_model",
  "busking",
  "sns_content",
  "music_show",
  "fansign",
  "variety_show",
  "event_stage",
  "rest",
  "trip",
  "counsel",
  "checkup",
] as const;
export type ActivityId = (typeof ACTIVITY_IDS)[number];

export type FansFormula =
  | "busking"
  | "sns"
  | "model"
  | "music_show"
  | "fansign"
  | "variety_show"
  | "event_stage";

/** 활동·이벤트 공용 조건. 모든 필드는 AND. */
export interface Requirement {
  minSkills?: Partial<Skills>;
  /** 하나라도 만족하면 통과 */
  anySkills?: Partial<Skills>;
  minFans?: number;
  maxFans?: number;
  minMoney?: number;
  debuted?: boolean;
  minMonth?: number;
  maxMonth?: number;
  phases?: CareerPhase[];
  /** flags[key]가 truthy 여야 함 */
  flag?: string;
  /** flags[key]가 falsy 여야 함 */
  notFlag?: string;
  minStress?: number;
  maxStress?: number;
  minStamina?: number;
  maxStamina?: number;
  minBond?: number;
  maxBond?: number;
  minReputation?: number;
  maxReputation?: number;
  injured?: boolean;
}

export interface ActivityDef {
  id: ActivityId;
  label: string;
  category: ActivityCategory;
  /** 이모지 1개 */
  icon: string;
  description: string;
  /** 만원. 양수 = 수입, 음수 = 비용. 버스킹 팁처럼 랜덤이면 [min, max] */
  money: number | [number, number];
  /** 체력 변화 (음수 = 소모) */
  stamina: number;
  /** 스트레스 변화 */
  stress: number;
  /** 기본 성장량 G 의 배수 */
  skillGain?: Partial<Record<SkillId, number>>;
  maxStaminaGain?: number;
  bond?: number;
  reputation?: number;
  fansFormula?: FansFormula;
  requires?: Requirement;
  /** 한 달에 배치 가능한 최대 횟수 */
  maxPerMonth?: number;
  healsInjury?: boolean;
}

/** 이벤트 선택지·규칙이 상태에 가하는 변화. 미지정 필드는 변화 없음. */
export interface StatDelta {
  skills?: Partial<Skills>;
  /** 모든 능력치에 동일하게 더함 (E27 "전 능력치 −2" 등) */
  allSkills?: number;
  stamina?: number;
  maxStamina?: number;
  stress?: number;
  money?: number;
  fans?: number;
  /** 팬 비율 변화. 0.5 = +50%, −0.1 = −10% */
  fansPct?: number;
  /** 팬 비율 변화 시 최소 절대 증가량 (E07 "×1.5, 최소 +1,000") */
  fansMin?: number;
  bond?: number;
  reputation?: number;
  injured?: boolean;
  setStress?: number;
  setStamina?: number;
  /** true 면 체력을 최대치로 */
  fullStamina?: boolean;
  flags?: Record<string, number | boolean>;
  /** 현재 월 + n 까지 훈련 ×1.15 (flags.training_boost_until 설정) */
  trainingBoostMonths?: number;
  /** 회사 지원금 삭감 개월 수 */
  supportCutMonths?: number;
  /** 가불 상환 개월 수 (자금 +100 은 money 로 별도 지정) */
  debtMonths?: number;
  /** 예능 고정 출연 개월 수 */
  varietyRegularMonths?: number;
  /** 재능 배수가 가장 높은 능력치에 더함 (E37) */
  bestTalentSkill?: number;
  /** 팬 증가에 페이즈 배수(phaseMul)를 곱함 (E39) */
  fansTimesPhaseMul?: number;
  /** 서바이벌 등 공식 기반 팬 증가: base + 코어평균 × perAvg */
  fansByCoreAverage?: { base: number; perAvg: number };
}

export interface OutcomeCheck {
  stat: SkillId | "bond" | "reputation" | "stress" | "fans" | "stamina";
  min: number;
  success: { text: string; effects: StatDelta };
  failure: { text: string; effects: StatDelta; endingId?: EndingId };
}

export interface EventChoice {
  id: string;
  label: string;
  /** 선택지 아래 작은 글씨 힌트 (예: "예능감 판정") */
  hint?: string;
  effects: StatDelta;
  resultText: string;
  check?: OutcomeCheck;
  /** 선택 즉시 엔딩으로 */
  endingId?: EndingId;
}

export type EventTriggerKind = "fixed_month" | "random" | "conditional";

export interface EventTrigger {
  kind: EventTriggerKind;
  /** fixed_month: 발생 월 (여러 달이면 배열) */
  month?: number | number[];
  /** random/conditional: 주당 발생 확률 0~1 */
  chance?: number;
  when?: Requirement & {
    activityCategory?: ActivityCategory;
    activityId?: ActivityId | ActivityId[];
  };
  once?: boolean;
  cooldownMonths?: number;
  /** true 면 월말 정산 직후 판정 (E33). 기본은 주차 활동 직후 */
  atMonthEnd?: boolean;
  /** 스캔들류: 성격 scandalMul 적용 */
  scandal?: boolean;
  /** 엔진 규칙이 강제로 띄우는 이벤트 (E31, E32). 확률 판정에서 제외 */
  forced?: boolean;
}

export const BG_IMAGE_IDS = [
  "practice_room",
  "dorm",
  "office",
  "cafe",
  "convenience_store",
  "park_busking",
  "stage_music_show",
  "fansign",
  "variety_studio",
  "airport",
  "award_stage",
  "hospital",
  "concert_arena",
  "recording_studio",
  "photo_studio",
] as const;
export type BackgroundImageId = (typeof BG_IMAGE_IDS)[number];

export const CG_IDS = [
  "debut_showcase",
  "first_win",
  "award_grand_prize",
  "scandal_news",
  "burnout_night",
  "world_tour",
  "bond_promise",
  "comeback_stage",
] as const;
export type CgId = (typeof CG_IDS)[number];

export interface GameEventDef {
  id: string;
  title: string;
  /** 상황 묘사 (나레이션 + 대사, 줄바꿈은 \n) */
  text: string;
  emotion?: Emotion;
  bg?: BackgroundImageId;
  cg?: CgId;
  trigger: EventTrigger;
  choices: EventChoice[];
  /** 동시 후보 시 높은 값 우선. 기본 0 */
  priority?: number;
}

export const ENDING_IDS = [
  "contract_terminated",
  "burnout_leave",
  "scandal_fall",
  "partner_secret",
  "world_star",
  "national_idol",
  "top_idol",
  "actor",
  "variety_star",
  "solo_vocalist",
  "performance_king",
  "hiphop_artist",
  "longrun_idol",
  "indie_musician",
  "ordinary_life",
] as const;
export type EndingId = (typeof ENDING_IDS)[number];

export type EndingGrade = "S" | "A" | "B" | "C" | "D";

export interface EndingDef {
  id: EndingId;
  title: string;
  grade: EndingGrade;
  /** 도감 한 줄 요약 (획득 후 공개) */
  summary: string;
  /** 미획득 시 도감에 보여줄 힌트 */
  hint: string;
  /** 에필로그 3~5문장, 줄바꿈 \n. {name} 은 아이돌 이름으로 치환 */
  text: string;
  /** 36개월차 판정용. 조기 엔딩은 항상 false 를 반환해도 된다 (엔진 규칙이 직접 지정) */
  condition: (state: GameState) => boolean;
}

// ---------------------------------------------------------------------------
// 게임 상태
// ---------------------------------------------------------------------------

export interface Condition {
  stamina: number;
  maxStamina: number;
  stress: number;
  injured: boolean;
  /** 부상 자연 회복까지 남은 개월 (부상 아닐 때 0) */
  injuredMonthsLeft: number;
}

export interface Social {
  fans: number;
  bond: number;
  reputation: number;
}

export interface Economy {
  /** 만원 */
  money: number;
  trainerTier: TrainerTier;
  supportCutMonthsLeft: number;
  debtMonthsLeft: number;
}

export type ComebackRank = "top1" | "top10" | "top50" | "fail";

export interface ComebackRecord {
  month: number;
  concept: ConceptId;
  focus: ComebackFocus;
  score: number;
  rank: ComebackRank;
  fansGained: number;
  moneyGained: number;
  /** 결과 화면 문구 (적성 힌트 포함) */
  text: string;
}

export type AwardId = "rookie" | "bonsang" | "daesang" | "popularity";

export const AWARD_LABELS: Record<AwardId, string> = {
  rookie: "신인상",
  bonsang: "본상",
  daesang: "대상",
  popularity: "인기상",
};

export interface AwardRecord {
  month: number;
  award: AwardId;
}

export interface Career {
  debuted: boolean;
  debutMonth: number | null;
  phase: CareerPhase;
  comebacks: ComebackRecord[];
  awards: AwardRecord[];
  topRankCount: number;
  nextComebackMonth: number | null;
  lastComebackMonth: number | null;
  debutEvalFailures: number;
  /** 마지막 데뷔 평가 신청 월 (재신청 2개월 제한용) */
  lastDebutEvalMonth: number | null;
}

export interface Idol {
  name: string;
  background: BackgroundId;
  personality: PersonalityId;
  talents: Record<SkillId, number>;
  conceptAffinity: Record<ConceptId, number>;
  skills: Skills;
  condition: Condition;
  social: Social;
}

export interface DebutEvalResult {
  month: number;
  score: number;
  passed: boolean;
  text: string;
}

export type UIPhase =
  | "planning"
  | "debut_eval"
  | "resolving"
  | "event"
  | "report"
  | "comeback"
  | "award"
  | "ended";

export type LogKind = "activity" | "event" | "system" | "month";

export interface LogEntry {
  /** 1~4, 월말 항목은 4 */
  week: number;
  kind: LogKind;
  text: string;
  deltas?: StatDelta;
}

export interface Snapshot {
  skills: Skills;
  stamina: number;
  maxStamina: number;
  stress: number;
  fans: number;
  money: number;
  bond: number;
  reputation: number;
}

export interface MonthReport {
  month: number;
  before: Snapshot;
  after: Snapshot;
  /** 항목별 수입/지출 (만원) */
  ledger: Array<{ label: string; amount: number }>;
  idolLine: string;
  emotion: Emotion;
  /** 공지 (부상 회복, 지원금 삭감, 페이즈 전환 등) */
  notices: string[];
}

export interface UIState {
  phase: UIPhase;
  /** 길이 4. null = 비어 있음 */
  plan: Array<ActivityId | null>;
  /** 0~3, 월말 처리 후 4 */
  weekIndex: number;
  /** 이번 달 로그 (월 시작 시 초기화) */
  log: LogEntry[];
  /** 이번 달 발생한 이벤트 수 (강제 이벤트 제외) */
  eventsThisMonth: number;
  pendingEventId: string | null;
  /** 이벤트 선택 결과 문구 (선택 직후 UI가 잠깐 표시) */
  lastChoiceText: string | null;
  /** 월말 이벤트가 진행 중이면 true (chooseOption 후 report 로) */
  pendingMonthEnd: boolean;
  report: MonthReport | null;
  lastDebutEval: DebutEvalResult | null;
  lastComeback: ComebackRecord | null;
  lastAwards: AwardRecord[];
}

export interface EndingResult {
  id: EndingId;
  month: number;
}

export interface MonthSummary extends Snapshot {
  month: number;
}

export interface SeenEvent {
  count: number;
  lastMonth: number;
}

export interface GameState {
  version: typeof GAME_VERSION;
  seed: number;
  /** 난수 내부 상태 (32bit 정수) */
  rngState: number;
  /** 1~36 */
  month: number;
  idol: Idol;
  career: Career;
  economy: Economy;
  flags: Record<string, number | boolean>;
  seenEvents: Record<string, SeenEvent>;
  ui: UIState;
  /** 월말마다 push */
  history: MonthSummary[];
  ending: EndingResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewGameConfig {
  name: string;
  background: BackgroundId;
  personality: PersonalityId;
  seed?: number;
}

// ---------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------

export interface SaveFile {
  version: typeof GAME_VERSION;
  savedAt: string;
  state: GameState;
}

export interface SaveSlotMeta {
  slot: number;
  name: string;
  month: number;
  phase: CareerPhase;
  fans: number;
  savedAt: string;
}

export interface EndingGalleryEntry {
  id: EndingId;
  idolName: string;
  month: number;
  achievedAt: string;
}

export interface GameSettings {
  speed: "normal" | "fast";
}
