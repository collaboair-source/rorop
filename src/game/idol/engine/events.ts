/**
 * 이벤트 판정 (GDD 9.1, TECH_SPEC 4.3)
 *
 * 판정 순서: ① fixed_month → ② conditional → ③ random.
 * 고정 이벤트는 "한 달 최대 2개" 제한을 받지 않고, 강제 이벤트(E31·E32)는 확률 판정에서 제외된다.
 */

import * as B from "../balance";
import { getActivity } from "../data/activities";
import {
  EVENTS,
  FORCED_EVENT_STAMINA_COLLAPSE,
  FORCED_EVENT_STRESS_BREAK,
  findEvent,
} from "../data/events";
import { getPersonality } from "../data/personalities";
import { SKILL_IDS, type ActivityId, type GameEventDef, type GameState, type OutcomeCheck, type Requirement } from "../types";
import { draw } from "./resolve";

type EventWhen = NonNullable<GameEventDef["trigger"]["when"]>;

/**
 * Requirement 로 표현할 수 없는 추가 조건 (GDD 표에는 있으나 타입 계약에 연산자가 없는 것).
 * - E04: 보컬 < 40
 */
const EXTRA_GUARDS: Record<string, (state: GameState) => boolean> = {
  vocal_crack: (state) => state.idol.skills.vocal < B.EVENT_VOCAL_CRACK_MAX_VOCAL,
};

/**
 * 성격 scandalMul 외의 추가 확률 배수.
 * - E19: 평판 < 60 이면 ×1.5
 */
const EXTRA_CHANCE_MUL: Record<string, (state: GameState) => number> = {
  dating_rumor: (state) =>
    state.idol.social.reputation < B.EVENT_DATING_RUMOR_LOW_REPUTATION
      ? B.EVENT_DATING_RUMOR_LOW_REPUTATION_MUL
      : 1,
};

// ---------------------------------------------------------------------------
// 조건 판정
// ---------------------------------------------------------------------------

/** Requirement 의 minStamina/maxStamina 는 "현재 체력"의 하한/상한을 뜻한다 */
export function matchesRequirement(state: GameState, req: Requirement | undefined): boolean {
  if (!req) return true;
  const { skills, condition, social } = state.idol;

  if (req.minSkills) {
    for (const id of SKILL_IDS) {
      const min = req.minSkills[id];
      if (typeof min === "number" && skills[id] < min) return false;
    }
  }
  if (req.anySkills) {
    let any = false;
    let has = false;
    for (const id of SKILL_IDS) {
      const min = req.anySkills[id];
      if (typeof min !== "number") continue;
      has = true;
      if (skills[id] >= min) any = true;
    }
    if (has && !any) return false;
  }
  if (typeof req.minFans === "number" && social.fans < req.minFans) return false;
  if (typeof req.maxFans === "number" && social.fans > req.maxFans) return false;
  if (typeof req.minMoney === "number" && state.economy.money < req.minMoney) return false;
  if (typeof req.debuted === "boolean" && state.career.debuted !== req.debuted) return false;
  if (typeof req.minMonth === "number" && state.month < req.minMonth) return false;
  if (typeof req.maxMonth === "number" && state.month > req.maxMonth) return false;
  if (req.phases && !req.phases.includes(state.career.phase)) return false;
  if (req.flag && !state.flags[req.flag]) return false;
  if (req.notFlag && state.flags[req.notFlag]) return false;
  if (typeof req.minStress === "number" && condition.stress < req.minStress) return false;
  if (typeof req.maxStress === "number" && condition.stress > req.maxStress) return false;
  if (typeof req.minStamina === "number" && condition.stamina < req.minStamina) return false;
  if (typeof req.maxStamina === "number" && condition.stamina > req.maxStamina) return false;
  if (typeof req.minBond === "number" && social.bond < req.minBond) return false;
  if (typeof req.maxBond === "number" && social.bond > req.maxBond) return false;
  if (typeof req.minReputation === "number" && social.reputation < req.minReputation) return false;
  if (typeof req.maxReputation === "number" && social.reputation > req.maxReputation) return false;
  if (typeof req.injured === "boolean" && condition.injured !== req.injured) return false;
  return true;
}

function matchesActivity(when: EventWhen | undefined, activityId: ActivityId | null): boolean {
  if (!when) return true;
  if (when.activityId) {
    if (!activityId) return false;
    const ids = Array.isArray(when.activityId) ? when.activityId : [when.activityId];
    if (!ids.includes(activityId)) return false;
  }
  if (when.activityCategory) {
    if (!activityId) return false;
    if (getActivity(activityId).category !== when.activityCategory) return false;
  }
  return true;
}

function matchesFixedMonth(def: GameEventDef, month: number): boolean {
  const m = def.trigger.month;
  if (typeof m === "number") return m === month;
  if (Array.isArray(m)) return m.includes(month);
  return false;
}

/** once/cooldown/같은 달 재발 방지 */
function passesHistory(state: GameState, def: GameEventDef): boolean {
  const seen = state.seenEvents[def.id];
  if (!seen) return true;
  if (def.trigger.once) return false;
  if (seen.lastMonth === state.month) return false;
  if (typeof def.trigger.cooldownMonths === "number") {
    if (state.month - seen.lastMonth < def.trigger.cooldownMonths) return false;
  }
  return true;
}

function baseEligible(state: GameState, def: GameEventDef, activityId: ActivityId | null): boolean {
  if (def.trigger.forced) return false;
  if (!passesHistory(state, def)) return false;
  if (!matchesRequirement(state, def.trigger.when)) return false;
  if (!matchesActivity(def.trigger.when, activityId)) return false;
  const guard = EXTRA_GUARDS[def.id];
  if (guard && !guard(state)) return false;
  return true;
}

function chanceOf(state: GameState, def: GameEventDef): number {
  const fallback =
    def.trigger.kind === "conditional" ? B.DEFAULT_CONDITIONAL_CHANCE : B.DEFAULT_RANDOM_CHANCE;
  let chance = typeof def.trigger.chance === "number" ? def.trigger.chance : fallback;
  if (def.trigger.scandal) chance *= getPersonality(state.idol.personality).scandalMul;
  const extra = EXTRA_CHANCE_MUL[def.id];
  if (extra) chance *= extra(state);
  return chance;
}

/** priority 내림차순, 동률이면 rng */
function pickByPriority(draft: GameState, pool: GameEventDef[]): GameEventDef | null {
  if (pool.length === 0) return null;
  let best = pool[0].priority ?? 0;
  for (const def of pool) best = Math.max(best, def.priority ?? 0);
  const top = pool.filter((d) => (d.priority ?? 0) === best);
  if (top.length === 1) return top[0];
  const index = Math.floor(draw(draft) * top.length);
  return top[Math.min(index, top.length - 1)];
}

// ---------------------------------------------------------------------------
// 공개(엔진 내부) API
// ---------------------------------------------------------------------------

/** 엔진 규칙이 강제로 띄우는 이벤트 (GDD 8.5). 체력 우선. */
export function forcedEventId(state: GameState): string | null {
  if (state.idol.condition.stamina <= 0) return FORCED_EVENT_STAMINA_COLLAPSE;
  if (state.idol.condition.stress >= B.STRESS_MAX) return FORCED_EVENT_STRESS_BREAK;
  return null;
}

/** 주차 활동 직후의 일반 이벤트 판정. rng 를 소비한다. */
export function rollWeekEvent(draft: GameState, weekIndex: number): GameEventDef | null {
  const activityId = draft.ui.plan[weekIndex] ?? null;

  const fixed = EVENTS.filter(
    (def) =>
      def.trigger.kind === "fixed_month" &&
      !def.trigger.atMonthEnd &&
      matchesFixedMonth(def, draft.month) &&
      baseEligible(draft, def, activityId),
  );
  if (fixed.length > 0) return pickByPriority(draft, fixed);

  if (draft.ui.eventsThisMonth >= B.MAX_EVENTS_PER_MONTH) return null;

  for (const kind of ["conditional", "random"] as const) {
    const pool = EVENTS.filter(
      (def) =>
        def.trigger.kind === kind && !def.trigger.atMonthEnd && baseEligible(draft, def, activityId),
    );
    const rolled: GameEventDef[] = [];
    for (const def of pool) {
      if (draw(draft) < chanceOf(draft, def)) rolled.push(def);
    }
    if (rolled.length > 0) return pickByPriority(draft, rolled);
  }
  return null;
}

/**
 * 월말 정산 직후의 이벤트 판정 (E33).
 * 월 최대 2개 제한과 무관하게 판정한다(생활고는 안전장치 역할).
 */
export function rollMonthEndEvent(draft: GameState): GameEventDef | null {
  const pool = EVENTS.filter((def) => def.trigger.atMonthEnd && baseEligible(draft, def, null));
  const rolled: GameEventDef[] = [];
  for (const def of pool) {
    if (draw(draft) < chanceOf(draft, def)) rolled.push(def);
  }
  return pickByPriority(draft, rolled);
}

/** 이벤트 발생 기록 (once/cooldown, 월 이벤트 수) */
export function markEventFired(draft: GameState, def: GameEventDef): void {
  const prev = draft.seenEvents[def.id];
  draft.seenEvents[def.id] = {
    count: (prev?.count ?? 0) + 1,
    lastMonth: draft.month,
  };
  const counts = def.trigger.kind !== "fixed_month" && !def.trigger.forced && !def.trigger.atMonthEnd;
  if (counts) draft.ui.eventsThisMonth += 1;
}

/** OutcomeCheck 의 대상 수치 */
export function checkStatValue(state: GameState, stat: OutcomeCheck["stat"]): number {
  switch (stat) {
    case "bond":
      return state.idol.social.bond;
    case "reputation":
      return state.idol.social.reputation;
    case "stress":
      return state.idol.condition.stress;
    case "fans":
      return state.idol.social.fans;
    case "stamina":
      return state.idol.condition.stamina;
    default:
      return state.idol.skills[stat];
  }
}

export function getEventDef(id: string | null): GameEventDef | null {
  if (!id) return null;
  return findEvent(id);
}
