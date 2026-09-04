/**
 * 주차 해결 — 활동 적용, 성장 공식(GDD 6절), 팬 공식(GDD 5.1), 효과(StatDelta) 적용.
 *
 * 이 파일의 함수들은 "draft"(이미 복사된 GameState)를 직접 변경한다.
 * 외부에 노출되는 순수 함수는 engine/index.ts 가 담당한다.
 */

import * as B from "../balance";
import { getActivity } from "../data/activities";
import { getPersonality } from "../data/personalities";
import { nextRandom } from "../rng";
import {
  CORE_SKILL_IDS,
  SKILL_IDS,
  SKILL_LABELS,
  type ActivityDef,
  type CareerPhase,
  type FansFormula,
  type GameState,
  type LogEntry,
  type Skills,
  type SkillId,
  type Snapshot,
  type StatDelta,
} from "../types";

// ---------------------------------------------------------------------------
// 기본 유틸
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 소수점 1자리 반올림 (부동소수 잡음 제거 → 결정성 유지) */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** rngState 를 소비해 [0,1) 난수를 뽑는다 */
export function draw(draft: GameState): number {
  const r = nextRandom(draft.rngState);
  draft.rngState = r.next;
  return r.value;
}

export function drawRange(draft: GameState, min: number, max: number): number {
  return min + draw(draft) * (max - min);
}

export function drawInt(draft: GameState, min: number, max: number): number {
  return min + Math.floor(draw(draft) * (max - min + 1));
}

export function coreAverageOf(skills: Skills): number {
  let sum = 0;
  for (const id of CORE_SKILL_IDS) sum += skills[id];
  return sum / CORE_SKILL_IDS.length;
}

export function phaseOf(debuted: boolean, fans: number): CareerPhase {
  if (!debuted) return "trainee";
  if (fans < B.PHASE_ROOKIE_MAX_FANS) return "rookie";
  if (fans < B.PHASE_RISING_MAX_FANS) return "rising";
  return "star";
}

export function phaseMulOf(state: GameState): number {
  return B.PHASE_FANS_MUL[state.career.phase];
}

export function snapshotOf(state: GameState): Snapshot {
  return {
    skills: { ...state.idol.skills },
    stamina: state.idol.condition.stamina,
    maxStamina: state.idol.condition.maxStamina,
    stress: state.idol.condition.stress,
    fans: state.idol.social.fans,
    money: state.economy.money,
    bond: state.idol.social.bond,
    reputation: state.idol.social.reputation,
  };
}

/** 트레이너 배수·레슨비가 붙는 활동인가 (자율 연습 제외) */
export function usesTrainer(activity: ActivityDef): boolean {
  return B.TRAINER_ACTIVITY_IDS.includes(activity.id);
}

/** 활동의 실제 자금 변화(만원). 랜덤 구간이면 rng 를 소비한다. */
export function activityMoneyDelta(draft: GameState, activity: ActivityDef): number {
  const base = Array.isArray(activity.money)
    ? drawInt(draft, activity.money[0], activity.money[1])
    : activity.money;
  const surcharge = usesTrainer(activity) ? B.TRAINER_LESSON_SURCHARGE[draft.economy.trainerTier] : 0;
  return base - surcharge;
}

/** rng 없이 계산하는 예상 자금 변화 (계획 미리보기용, 랜덤 구간은 중앙값) */
export function estimateMoneyDelta(state: GameState, activity: ActivityDef): number {
  const base = Array.isArray(activity.money)
    ? Math.round((activity.money[0] + activity.money[1]) / 2)
    : activity.money;
  const surcharge = usesTrainer(activity) ? B.TRAINER_LESSON_SURCHARGE[state.economy.trainerTier] : 0;
  return base - surcharge;
}

/** 성격·부상 배수를 반영한 체력 변화 */
export function staminaDeltaOf(state: GameState, activity: ActivityDef): number {
  const p = getPersonality(state.idol.personality);
  if (activity.stamina >= 0) return Math.round(activity.stamina * p.restMul);
  const injuryMul = state.idol.condition.injured ? B.INJURY_STAMINA_COST_MUL : 1;
  return Math.round(activity.stamina * injuryMul);
}

/** 성격 배수를 반영한 스트레스 변화 */
export function stressDeltaOf(state: GameState, activity: ActivityDef): number {
  const p = getPersonality(state.idol.personality);
  const mul = activity.stress >= 0 ? p.stressMul : p.restMul;
  return Math.round(activity.stress * mul);
}

// ---------------------------------------------------------------------------
// 성장 공식 (GDD 6절)
// ---------------------------------------------------------------------------

export function dimOf(current: number): number {
  return Math.max(B.DIM_FLOOR, 1 - current / B.DIM_DIVISOR);
}

export function conditionMulOf(state: GameState): number {
  let mul = 1;
  if (state.idol.condition.stamina < B.STAMINA_LOW) mul *= B.STAMINA_LOW_MUL;
  if (state.idol.condition.stress >= B.STRESS_HIGH) mul *= B.STRESS_HIGH_MUL;
  if (state.idol.condition.injured) mul *= B.INJURY_TRAINING_MUL;
  return mul;
}

export function trainingBoostMulOf(state: GameState): number {
  const until = state.flags.training_boost_until;
  if (typeof until === "number" && until >= state.month) return B.TRAINING_BOOST_MUL;
  return 1;
}

/**
 * gain = BASE × talent × trainerMul × dim × condMul × personalityMul × boostMul × rng × skillGain
 * rng 를 1회 소비한다.
 */
export function computeGain(
  draft: GameState,
  skill: SkillId,
  skillGainMul: number,
  withTrainer: boolean,
  isTraining: boolean,
): number {
  const p = getPersonality(draft.idol.personality);
  const talent = draft.idol.talents[skill];
  const trainerMul = withTrainer ? B.TRAINER_MULS[draft.economy.trainerTier] : 1;
  const rng = drawRange(draft, B.GROWTH_RNG_MIN, B.GROWTH_RNG_MAX);
  const raw =
    B.BASE_GAIN *
    talent *
    trainerMul *
    dimOf(draft.idol.skills[skill]) *
    conditionMulOf(draft) *
    p.trainingMul *
    trainingBoostMulOf(draft) *
    rng *
    skillGainMul;
  const floored = isTraining ? Math.max(B.MIN_TRAINING_GAIN, raw) : raw;
  const room = B.SKILL_MAX - draft.idol.skills[skill];
  return round1(Math.max(0, Math.min(room, floored)));
}

// ---------------------------------------------------------------------------
// 팬 공식 (GDD 5.1)
// ---------------------------------------------------------------------------

export function musicShowActiveMul(state: GameState): number {
  const last = state.career.lastComebackMonth;
  if (last !== null && state.month - last <= B.FANS_MUSIC_SHOW_ACTIVE_MONTHS) {
    return B.FANS_MUSIC_SHOW_ACTIVE_MUL;
  }
  return B.FANS_MUSIC_SHOW_INACTIVE_MUL;
}

/** 팬 증가량. rng 를 1회 소비하고 성격 fansMul 을 적용한다. */
export function computeFansGain(draft: GameState, formula: FansFormula): number {
  const s = draft.idol.skills;
  const fans = draft.idol.social.fans;
  const pm = phaseMulOf(draft);
  const rng = drawRange(draft, B.FANS_RNG_MIN, B.FANS_RNG_MAX);
  let base = 0;

  switch (formula) {
    case "busking":
      base =
        (Math.max(s.vocal, s.dance) * B.FANS_BUSKING_SKILL_MUL + s.visual * B.FANS_BUSKING_VISUAL_MUL) *
        pm *
        rng;
      break;
    case "sns": {
      const reach =
        1 + Math.log10(fans + B.FANS_SNS_LOG_OFFSET) / B.FANS_SNS_LOG_DIVISOR;
      base =
        (s.visual * B.FANS_SNS_VISUAL_MUL + s.variety * B.FANS_SNS_VARIETY_MUL + B.FANS_SNS_BASE) *
        reach *
        rng;
      break;
    }
    case "model":
      base = s.visual * B.FANS_MODEL_VISUAL_MUL * pm * rng;
      break;
    case "music_show": {
      const perf =
        ((s.vocal + s.dance + s.rap) / 3) * B.FANS_MUSIC_SHOW_PERF_SKILL_WEIGHT +
        s.visual * B.FANS_MUSIC_SHOW_PERF_VISUAL_WEIGHT;
      const core = Math.max(
        B.FANS_MUSIC_SHOW_FLOOR,
        fans * B.FANS_MUSIC_SHOW_RATE * musicShowActiveMul(draft),
      );
      base = (core + perf * B.FANS_MUSIC_SHOW_PERF_MUL) * rng;
      break;
    }
    case "fansign":
      base = Math.max(B.FANS_FANSIGN_FLOOR, fans * B.FANS_FANSIGN_RATE) * rng;
      break;
    case "variety_show":
      base =
        Math.max(B.FANS_VARIETY_SHOW_FLOOR, fans * B.FANS_VARIETY_SHOW_RATE) *
        (s.variety / B.FANS_VARIETY_SHOW_DIVISOR) *
        rng;
      break;
    case "event_stage":
      base = Math.max(B.FANS_EVENT_STAGE_FLOOR, fans * B.FANS_EVENT_STAGE_RATE) * rng;
      break;
  }

  const p = getPersonality(draft.idol.personality);
  return Math.max(0, Math.round(Math.round(base) * p.fansMul));
}

// ---------------------------------------------------------------------------
// 효과(StatDelta) 적용
// ---------------------------------------------------------------------------

export function addSkill(draft: GameState, skill: SkillId, amount: number): void {
  draft.idol.skills[skill] = round1(clamp(draft.idol.skills[skill] + amount, B.SKILL_MIN, B.SKILL_MAX));
}

export function addStamina(draft: GameState, amount: number): void {
  const c = draft.idol.condition;
  c.stamina = Math.round(clamp(c.stamina + amount, 0, c.maxStamina));
}

export function addStress(draft: GameState, amount: number): void {
  const c = draft.idol.condition;
  c.stress = Math.round(clamp(c.stress + amount, B.STRESS_MIN, B.STRESS_MAX));
}

export function addMoney(draft: GameState, amount: number): void {
  draft.economy.money = Math.round(Math.max(B.MONEY_MIN, draft.economy.money + amount));
}

export function addFans(draft: GameState, amount: number): void {
  draft.idol.social.fans = Math.max(0, Math.round(draft.idol.social.fans + amount));
}

export function addBond(draft: GameState, amount: number): void {
  const p = getPersonality(draft.idol.personality);
  const applied = amount > 0 ? amount * p.bondMul : amount;
  draft.idol.social.bond = Math.round(clamp(draft.idol.social.bond + applied, B.BOND_MIN, B.BOND_MAX));
}

export function addReputation(draft: GameState, amount: number): void {
  draft.idol.social.reputation = Math.round(
    clamp(draft.idol.social.reputation + amount, B.REPUTATION_MIN, B.REPUTATION_MAX),
  );
}

export function setInjured(draft: GameState, injured: boolean): void {
  draft.idol.condition.injured = injured;
  draft.idol.condition.injuredMonthsLeft = injured ? B.INJURY_RECOVERY_MONTHS : 0;
}

export function bestTalentSkill(draft: GameState): SkillId {
  let best: SkillId = SKILL_IDS[0];
  for (const id of SKILL_IDS) {
    if (draft.idol.talents[id] > draft.idol.talents[best]) best = id;
  }
  return best;
}

/** 이벤트 선택지·규칙의 효과를 적용한다 (성격 스트레스 배수는 활동에만 적용되므로 여기선 원값 사용) */
export function applyDelta(draft: GameState, delta: StatDelta): void {
  if (delta.skills) {
    for (const id of SKILL_IDS) {
      const v = delta.skills[id];
      if (typeof v === "number") addSkill(draft, id, v);
    }
  }
  if (typeof delta.allSkills === "number") {
    for (const id of SKILL_IDS) addSkill(draft, id, delta.allSkills);
  }
  if (typeof delta.bestTalentSkill === "number") {
    addSkill(draft, bestTalentSkill(draft), delta.bestTalentSkill);
  }
  if (typeof delta.maxStamina === "number") {
    draft.idol.condition.maxStamina = round1(
      clamp(draft.idol.condition.maxStamina + delta.maxStamina, B.MAX_STAMINA_MIN, B.MAX_STAMINA_MAX),
    );
    addStamina(draft, 0);
  }
  if (typeof delta.stamina === "number") addStamina(draft, delta.stamina);
  if (typeof delta.stress === "number") addStress(draft, delta.stress);
  if (typeof delta.money === "number") addMoney(draft, delta.money);
  if (typeof delta.fans === "number") addFans(draft, delta.fans);
  if (typeof delta.fansPct === "number") {
    const raw = Math.round(draft.idol.social.fans * delta.fansPct);
    const gained = delta.fansPct > 0 && typeof delta.fansMin === "number" ? Math.max(delta.fansMin, raw) : raw;
    addFans(draft, gained);
  }
  if (typeof delta.fansTimesPhaseMul === "number") {
    addFans(draft, Math.round(delta.fansTimesPhaseMul * phaseMulOf(draft)));
  }
  if (delta.fansByCoreAverage) {
    const { base, perAvg } = delta.fansByCoreAverage;
    addFans(draft, Math.round(base + coreAverageOf(draft.idol.skills) * perAvg));
  }
  if (typeof delta.bond === "number") addBond(draft, delta.bond);
  if (typeof delta.reputation === "number") addReputation(draft, delta.reputation);
  if (typeof delta.injured === "boolean") setInjured(draft, delta.injured);
  if (typeof delta.setStress === "number") {
    draft.idol.condition.stress = clamp(delta.setStress, B.STRESS_MIN, B.STRESS_MAX);
  }
  if (typeof delta.setStamina === "number") {
    draft.idol.condition.stamina = clamp(delta.setStamina, 0, draft.idol.condition.maxStamina);
  }
  if (delta.fullStamina) draft.idol.condition.stamina = draft.idol.condition.maxStamina;
  if (typeof delta.trainingBoostMonths === "number") {
    draft.flags.training_boost_until = draft.month + delta.trainingBoostMonths;
  }
  if (typeof delta.supportCutMonths === "number") {
    draft.economy.supportCutMonthsLeft = delta.supportCutMonths;
  }
  if (typeof delta.debtMonths === "number") {
    draft.economy.debtMonthsLeft = delta.debtMonths;
  }
  if (typeof delta.varietyRegularMonths === "number") {
    draft.flags.variety_regular_until = draft.month + delta.varietyRegularMonths;
  }
  if (delta.flags) {
    for (const [key, value] of Object.entries(delta.flags)) draft.flags[key] = value;
  }
}

// ---------------------------------------------------------------------------
// 로그 문구
// ---------------------------------------------------------------------------

export function signed(value: number): string {
  const rounded = round1(value);
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded)}`;
}

export function formatFans(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${(value / 10_000).toFixed(1)}만`;
  return value.toLocaleString("ko-KR");
}

// ---------------------------------------------------------------------------
// 주차 해결
// ---------------------------------------------------------------------------

/** 매주 자연 회복 (활동 전) */
export function naturalRecovery(draft: GameState): void {
  addStamina(draft, B.WEEKLY_STAMINA_RECOVERY);
}

/**
 * 한 주 활동을 적용하고 로그를 남긴다.
 * 자금이 부족하면 활동을 취소하고 취소 로그만 남긴다.
 */
export function resolveWeek(draft: GameState, weekIndex: number): void {
  const week = weekIndex + 1;
  naturalRecovery(draft);

  const activityId = draft.ui.plan[weekIndex];
  if (!activityId) {
    draft.ui.log.push({ week, kind: "activity", text: `${week}주차: 계획 없음 — 그냥 흘려보냈다` });
    return;
  }
  const activity = getActivity(activityId);

  // a. 자금
  const moneyDelta = activityMoneyDelta(draft, activity);
  if (moneyDelta < 0 && draft.economy.money + moneyDelta < B.MONEY_MIN) {
    draft.ui.log.push({
      week,
      kind: "activity",
      text: `${week}주차: ${activity.label} — 자금이 부족해 취소됐다`,
    });
    return;
  }
  addMoney(draft, moneyDelta);

  // b. 체력·스트레스
  const staminaDelta = staminaDeltaOf(draft, activity);
  const stressDelta = stressDeltaOf(draft, activity);
  addStamina(draft, staminaDelta);
  addStress(draft, stressDelta);
  if (activity.healsInjury && draft.idol.condition.injured) setInjured(draft, false);

  // c. 성장
  const applied: StatDelta = { skills: {} };
  const gains: string[] = [];
  if (activity.skillGain) {
    const isTraining = activity.category === "training";
    const withTrainer = usesTrainer(activity);
    for (const id of SKILL_IDS) {
      const mul = activity.skillGain[id];
      if (typeof mul !== "number") continue;
      const gain = computeGain(draft, id, mul, withTrainer, isTraining);
      if (gain > 0) {
        addSkill(draft, id, gain);
        applied.skills = { ...applied.skills, [id]: gain };
        gains.push(`${SKILL_LABELS[id]} ${signed(gain)}`);
      }
    }
  }
  if (typeof activity.maxStaminaGain === "number") {
    draft.idol.condition.maxStamina = round1(
      clamp(
        draft.idol.condition.maxStamina + activity.maxStaminaGain,
        B.MAX_STAMINA_MIN,
        B.MAX_STAMINA_MAX,
      ),
    );
    applied.maxStamina = activity.maxStaminaGain;
  }

  // d. 팬
  let fansGain = 0;
  if (activity.fansFormula) {
    fansGain = computeFansGain(draft, activity.fansFormula);
    addFans(draft, fansGain);
    applied.fans = fansGain;
    gains.push(`팬 +${formatFans(fansGain)}`);
  }

  // e. 호감도·평판
  if (typeof activity.bond === "number") {
    addBond(draft, activity.bond);
    applied.bond = activity.bond;
  }
  if (typeof activity.reputation === "number") {
    addReputation(draft, activity.reputation);
    applied.reputation = activity.reputation;
  }
  if (activity.id === "counsel") draft.flags.counsel_used_month = draft.month;

  // f. 로그
  applied.money = moneyDelta;
  applied.stamina = staminaDelta;
  applied.stress = stressDelta;
  const parts = [...gains];
  if (moneyDelta !== 0) parts.push(`자금 ${signed(moneyDelta)}만`);
  parts.push(`체력 ${signed(staminaDelta)}`);
  if (stressDelta !== 0) parts.push(`스트레스 ${signed(stressDelta)}`);
  const entry: LogEntry = {
    week,
    kind: "activity",
    text: `${week}주차: ${activity.label} — ${parts.join(", ")}`,
    deltas: applied,
  };
  draft.ui.log.push(entry);
}
