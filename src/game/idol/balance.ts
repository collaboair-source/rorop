/**
 * 밸런스 상수 — GDD(docs/idol-game/01_GDD.md) 수치의 단일 출처.
 * 엔진 코드에는 매직 넘버를 쓰지 않고 항상 이 파일의 상수를 참조한다.
 */

import type { ActivityId, AwardId, CareerPhase, ComebackRank, TrainerTier } from "./types";

// ---------------------------------------------------------------------------
// 성장 공식 (GDD 6절)
// gain = BASE_GAIN × talent × trainerMul × dim(skill) × condMul × personalityMul
//        × boostMul × rng(0.85~1.15) × skillGain
// ---------------------------------------------------------------------------

export const BASE_GAIN = 4;
/** dim(skill) = max(DIM_FLOOR, 1 − 현재치/DIM_DIVISOR) */
export const DIM_DIVISOR = 120;
export const DIM_FLOOR = 0.08;
export const GROWTH_RNG_MIN = 0.85;
export const GROWTH_RNG_MAX = 1.15;
/** 훈련(training) 활동의 최소 성장량 */
export const MIN_TRAINING_GAIN = 0.5;
export const SKILL_MIN = 0;
export const SKILL_MAX = 100;
/** 라이벌 이벤트 등으로 flags.training_boost_until ≥ 현재 월이면 적용 */
export const TRAINING_BOOST_MUL = 1.15;

// ---------------------------------------------------------------------------
// 트레이너 (GDD 4.4)
// ---------------------------------------------------------------------------

export const TRAINER_MIN_TIER: TrainerTier = 1;
export const TRAINER_MAX_TIER: TrainerTier = 3;
export const TRAINER_MULS: Record<TrainerTier, number> = { 1: 1.0, 2: 1.25, 3: 1.5 };
/** 등급별 레슨비 추가분 (만원) */
export const TRAINER_LESSON_SURCHARGE: Record<TrainerTier, number> = { 1: 0, 2: 10, 3: 20 };
/** 해당 등급으로 올릴 때 드는 비용 (만원) */
export const TRAINER_UPGRADE_COST: Record<TrainerTier, number> = { 1: 0, 2: 300, 3: 800 };
/**
 * 트레이너 배수·레슨비가 적용되는 활동.
 * GDD 6절 "trainerMul … 자율 연습에는 미적용" → training 분류 중 practice_* 를 제외한 유료 훈련.
 */
export const TRAINER_ACTIVITY_IDS: readonly ActivityId[] = [
  "lesson_vocal",
  "lesson_dance",
  "lesson_rap",
  "lesson_acting",
  "lesson_variety",
  "styling",
  "fitness",
];

// ---------------------------------------------------------------------------
// 컨디션 (GDD 4.2)
// ---------------------------------------------------------------------------

/** 매주 자연 회복 */
export const WEEKLY_STAMINA_RECOVERY = 5;
/** 체력이 이 값 미만이면 훈련 효과 ×STAMINA_LOW_MUL */
export const STAMINA_LOW = 30;
export const STAMINA_LOW_MUL = 0.5;
/** 스트레스가 이 값 이상이면 훈련 효과 ×STRESS_HIGH_MUL */
export const STRESS_HIGH = 70;
export const STRESS_HIGH_MUL = 0.7;
export const INJURY_TRAINING_MUL = 0.5;
export const INJURY_STAMINA_COST_MUL = 1.3;
/** 방치 시 자연 회복까지의 개월 수 */
export const INJURY_RECOVERY_MONTHS = 2;
export const STRESS_MIN = 0;
export const STRESS_MAX = 100;
export const MAX_STAMINA_MIN = 80;
export const MAX_STAMINA_MAX = 150;

// ---------------------------------------------------------------------------
// 사회 (GDD 4.3, 8.5)
// ---------------------------------------------------------------------------

export const BOND_MIN = 0;
export const BOND_MAX = 100;
/** 호감도 소프트캡: 이 값 이상에서는 증가분이 ×BOND_SOFT_CAP_MUL 로 줄어든다 (감소는 그대로) */
export const BOND_SOFT_CAP = 80;
export const BOND_SOFT_CAP_MUL = 0.5;
export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 100;
/** 평판이 이 값 이하면 즉시 엔딩 scandal_fall */
export const SCANDAL_FALL_REPUTATION = 10;
/** E31 붙잡기 성공 기준 호감도 */
export const STRESS_BREAK_BOND = 40;
/** 슬럼프 처리 결과 */
export const SLUMP_STRESS = 50;
export const SLUMP_ALL_SKILLS = -3;

// ---------------------------------------------------------------------------
// 팬 (GDD 5.1, 8.1)
// ---------------------------------------------------------------------------

export const PHASE_FANS_MUL: Record<CareerPhase, number> = {
  trainee: 1.0,
  rookie: 3.0,
  rising: 5.0,
  star: 8.0,
};
export const FANS_RNG_MIN = 0.8;
export const FANS_RNG_MAX = 1.2;
/** 커리어 페이즈 임계값 */
export const PHASE_ROOKIE_MAX_FANS = 300_000;
export const PHASE_RISING_MAX_FANS = 1_500_000;

export const FANS_BUSKING_SKILL_MUL = 8;
export const FANS_BUSKING_VISUAL_MUL = 4;

export const FANS_SNS_VISUAL_MUL = 6;
export const FANS_SNS_VARIETY_MUL = 6;
export const FANS_SNS_BASE = 100;
export const FANS_SNS_LOG_OFFSET = 10;
export const FANS_SNS_LOG_DIVISOR = 4;

export const FANS_MODEL_VISUAL_MUL = 4;

export const FANS_MUSIC_SHOW_FLOOR = 2000;
export const FANS_MUSIC_SHOW_RATE = 0.04;
export const FANS_MUSIC_SHOW_PERF_MUL = 30;
export const FANS_MUSIC_SHOW_PERF_SKILL_WEIGHT = 0.6;
export const FANS_MUSIC_SHOW_PERF_VISUAL_WEIGHT = 0.4;
/** 마지막 컴백 후 이 개월 수 이내면 activeMul 1.0, 아니면 0.4 */
export const FANS_MUSIC_SHOW_ACTIVE_MONTHS = 2;
export const FANS_MUSIC_SHOW_ACTIVE_MUL = 1.0;
export const FANS_MUSIC_SHOW_INACTIVE_MUL = 0.4;

export const FANS_FANSIGN_FLOOR = 1000;
export const FANS_FANSIGN_RATE = 0.02;

export const FANS_VARIETY_SHOW_FLOOR = 3000;
export const FANS_VARIETY_SHOW_RATE = 0.03;
export const FANS_VARIETY_SHOW_DIVISOR = 50;

export const FANS_EVENT_STAGE_FLOOR = 500;
export const FANS_EVENT_STAGE_RATE = 0.005;

// ---------------------------------------------------------------------------
// 경제 (GDD 7절)
// ---------------------------------------------------------------------------

export const MONEY_MIN = 0;
export const MONTHLY_SUPPORT = 40;
export const MONTHLY_SUPPORT_CUT = 20;
export const MONTHLY_DORM_COST = 20;
/** 데뷔 후 팬 수익 = min(CAP, floor(팬/UNIT) × PER_UNIT) */
export const FAN_REVENUE_UNIT = 20_000;
export const FAN_REVENUE_PER_UNIT = 10;
export const FAN_REVENUE_CAP = 1000;
export const DEBT_MONTHLY_REPAY = 30;
export const VARIETY_REGULAR_MONEY = 100;
export const VARIETY_REGULAR_FANS_PCT = 0.03;
export const VARIETY_REGULAR_STAMINA = -10;
/** 데뷔 후 팬 자연 변동 */
export const PROMO_FANS_PCT = 0.01;
export const NO_PROMO_FANS_PCT = -0.03;
/** 연습생 월말 자금이 이 값 미만이면 E33 후보 */
export const MONEY_CRISIS_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// 데뷔 평가 (GDD 8.2)
// ---------------------------------------------------------------------------

export const DEBUT_MIN_MONTH = 6;
export const DEBUT_MIN_CORE_AVG = 40;
export const DEBUT_MIN_FANS = 3000;
export const DEBUT_PASS_SCORE = 50;
export const DEBUT_VISUAL_BASE = 50;
export const DEBUT_VISUAL_WEIGHT = 0.2;
export const DEBUT_FANS_DIVISOR = 1000;
export const DEBUT_FANS_CAP = 10;
/** 점수에 더해지는 rng 범위 (±) */
export const DEBUT_SCORE_RNG = 5;
export const DEBUT_REQUEST_STRESS = 10;
export const DEBUT_FAIL_STRESS = 15;
export const DEBUT_FAIL_BOND = -2;
/** 재신청 가능까지의 개월 수 */
export const DEBUT_RETRY_MONTHS = 2;
export const DEBUT_SHOWCASE_FANS_BASE = 15_000;
export const DEBUT_SHOWCASE_FANS_PER_SCORE = 200;
export const DEBUT_SHOWCASE_REPUTATION = 5;
/** 데뷔 후 첫 컴백까지의 개월 수 (이후에도 동일 간격) */
export const COMEBACK_INTERVAL = 4;
/** 이 달 월말까지 미데뷔면 계약 종료 */
export const CONTRACT_DEADLINE_MONTH = 24;
/** 최후통첩 안내 월 */
export const DEBUT_DEADLINE_NOTICE_MONTH = 18;

// ---------------------------------------------------------------------------
// 컴백 (GDD 8.3)
// ---------------------------------------------------------------------------

export const COMEBACK_FOCUS_WEIGHT = 0.45;
export const COMEBACK_CORE_WEIGHT = 0.25;
export const COMEBACK_VISUAL_WEIGHT = 0.15;
export const COMEBACK_FANS_WEIGHT = 0.15;
export const COMEBACK_FANS_LOG_MUL = 12;
export const COMEBACK_FANS_LOG_CAP = 100;
export const COMEBACK_SCORE_RNG = 5;
/** 자작곡(E26) 배수 */
export const SELF_PRODUCE_SKILL_LINE = 75;
export const SELF_PRODUCE_HIGH_MUL = 1.15;
export const SELF_PRODUCE_LOW_MUL = 0.9;

export interface ComebackTier {
  rank: ComebackRank;
  minScore: number;
  fansPct: number;
  fansFloor: number;
  money: number;
  reputation: number;
  stress: number;
}

/** 점수 내림차순. 첫 매치가 결과 */
export const COMEBACK_TIERS: readonly ComebackTier[] = [
  { rank: "top1", minScore: 85, fansPct: 0.6, fansFloor: 50_000, money: 800, reputation: 3, stress: 0 },
  { rank: "top10", minScore: 70, fansPct: 0.3, fansFloor: 20_000, money: 400, reputation: 1, stress: 0 },
  { rank: "top50", minScore: 55, fansPct: 0.12, fansFloor: 8_000, money: 150, reputation: 0, stress: 0 },
  {
    rank: "fail",
    minScore: Number.NEGATIVE_INFINITY,
    fansPct: -0.05,
    fansFloor: 0,
    money: 30,
    reputation: -2,
    stress: 10,
  },
];

/** 결과 문구의 콘셉트 적성 힌트 기준 */
export const AFFINITY_GOOD = 1.1;
export const AFFINITY_BAD = 0.9;

// ---------------------------------------------------------------------------
// 연말 시상식 (GDD 8.4)
// ---------------------------------------------------------------------------

export const AWARD_MONTHS: readonly number[] = [12, 24, 36];
export const MONTHS_PER_YEAR = 12;

export const AWARD_ROOKIE_MIN_FANS = 200_000;
export const AWARD_ROOKIE_FANS_PCT = 0.1;
export const AWARD_ROOKIE_REPUTATION = 5;
export const AWARD_ROOKIE_BOND = 3;

export const AWARD_BONSANG_MIN_FANS = 1_000_000;
export const AWARD_BONSANG_FANS_PCT = 0.1;
export const AWARD_BONSANG_MONEY = 300;

export const AWARD_DAESANG_MIN_FANS = 3_000_000;
export const AWARD_DAESANG_MIN_CORE_AVG = 80;
export const AWARD_DAESANG_FANS_PCT = 0.15;
export const AWARD_DAESANG_MONEY = 1000;
export const AWARD_DAESANG_REPUTATION = 10;

export const AWARD_POPULARITY_MIN_TOP1 = 2;
export const AWARD_POPULARITY_FANS_PCT = 0.05;

/** 판정 순서 */
export const AWARD_ORDER: readonly AwardId[] = ["rookie", "bonsang", "daesang", "popularity"];

// ---------------------------------------------------------------------------
// 이벤트 (GDD 9.1)
// ---------------------------------------------------------------------------

/** 강제·고정 이벤트를 제외한 한 달 최대 이벤트 수 */
export const MAX_EVENTS_PER_MONTH = 2;
/** conditional 이벤트에 chance 가 없으면 항상 발생 후보 */
export const DEFAULT_CONDITIONAL_CHANCE = 1;
export const DEFAULT_RANDOM_CHANCE = 0;
/** E04: 보컬이 이 값 미만일 때만 */
export const EVENT_VOCAL_CRACK_MAX_VOCAL = 40;
/** E19: 평판이 이 값 미만이면 확률 ×배수 */
export const EVENT_DATING_RUMOR_LOW_REPUTATION = 60;
export const EVENT_DATING_RUMOR_LOW_REPUTATION_MUL = 1.5;

// ---------------------------------------------------------------------------
// 무드·대사 (GDD 10.2)
// ---------------------------------------------------------------------------

export const MOOD_STRESS_LINE = 70;
export const MOOD_TIRED_STAMINA_LINE = 30;
export const MOOD_BOND_LINE = 70;
/** 이번 달 팬이 이 비율 이상 늘면 happy */
export const MOOD_HAPPY_FANS_PCT = 0.2;
/** getIdolLine 의 결정적 선택에 쓰는 상수 */
export const DIALOGUE_PICK_MONTH_MUL = 31;
export const DIALOGUE_PICK_MOOD_MUL = 17;

// ---------------------------------------------------------------------------
// 호감도 구간 (GDD 10.1)
// ---------------------------------------------------------------------------

export const BOND_TIER_LINES: readonly number[] = [30, 60, 85];
