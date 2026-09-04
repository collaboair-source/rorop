/** 월 계획 — 슬롯 조작, 활동 가용성, 예상치, 트레이너 업그레이드 */

import * as B from "../balance";
import { ACTIVITIES, getActivity } from "../data/activities";
import { SKILL_LABELS, WEEKS_PER_MONTH, type ActivityDef, type ActivityId, type GameState, type SkillId } from "../types";
import { estimateMoneyDelta, staminaDeltaOf, stressDeltaOf } from "./resolve";

export interface ActivityAvailability {
  def: ActivityDef;
  available: boolean;
  reason?: string;
}

export interface PlanPreview {
  money: number;
  stamina: number;
  stress: number;
  valid: boolean;
  problems: string[];
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function skillListText(skills: Partial<Record<SkillId, number>>): string {
  return Object.entries(skills)
    .map(([id, min]) => `${SKILL_LABELS[id as SkillId]} ${min}`)
    .join(", ");
}

/** 이번 달 계획에 이미 배치된 횟수 (weekIndex 를 주면 그 칸은 제외) */
function countInPlan(state: GameState, id: ActivityId, excludeIndex?: number): number {
  let count = 0;
  state.ui.plan.forEach((slot, index) => {
    if (index === excludeIndex) return;
    if (slot === id) count += 1;
  });
  return count;
}

/** 자금을 제외한 하드 조건 (페이즈·능력치·월 제한) */
export function hardBlockReason(
  state: GameState,
  def: ActivityDef,
  excludeIndex?: number,
): string | null {
  const req = def.requires;
  if (req) {
    if (typeof req.debuted === "boolean" && state.career.debuted !== req.debuted) {
      return req.debuted ? "데뷔 후에만 가능" : "연습생 기간에만 가능";
    }
    if (req.phases && !req.phases.includes(state.career.phase)) {
      return "지금 단계에서는 할 수 없음";
    }
    if (req.minSkills) {
      for (const [id, min] of Object.entries(req.minSkills)) {
        if (typeof min !== "number") continue;
        if (state.idol.skills[id as SkillId] < min) {
          return `${skillListText(req.minSkills)} 이상 필요`;
        }
      }
    }
    if (req.anySkills) {
      const entries = Object.entries(req.anySkills).filter(([, min]) => typeof min === "number");
      if (entries.length > 0) {
        const ok = entries.some(([id, min]) => state.idol.skills[id as SkillId] >= (min as number));
        if (!ok) return `${skillListText(req.anySkills)} 중 하나 이상 필요`;
      }
    }
    if (typeof req.injured === "boolean" && state.idol.condition.injured !== req.injured) {
      return req.injured ? "부상 중에만 가능" : "부상 중에는 불가";
    }
  }
  if (typeof def.maxPerMonth === "number" && countInPlan(state, def.id, excludeIndex) >= def.maxPerMonth) {
    return `이번 달 ${def.maxPerMonth}회까지만 가능`;
  }
  return null;
}

export function getAvailableActivities(state: GameState): ActivityAvailability[] {
  return ACTIVITIES.map((def) => {
    const hard = hardBlockReason(state, def);
    if (hard) return { def, available: false, reason: hard };
    const cost = estimateMoneyDelta(state, def);
    if (cost < 0 && state.economy.money + cost < B.MONEY_MIN) {
      return { def, available: false, reason: `자금 부족 (${Math.abs(cost)}만원 필요)` };
    }
    return { def, available: true };
  });
}

export function setPlanSlot(
  state: GameState,
  weekIndex: 0 | 1 | 2 | 3,
  activityId: ActivityId | null,
): GameState {
  if (state.ui.phase !== "planning") return state;
  if (weekIndex < 0 || weekIndex >= WEEKS_PER_MONTH) return state;
  if (activityId !== null) {
    const def = getActivity(activityId);
    if (hardBlockReason(state, def, weekIndex)) return state;
  }
  const next = clone(state);
  next.ui.plan[weekIndex] = activityId;
  next.updatedAt = new Date().toISOString();
  return next;
}

/** 4칸을 같은 활동으로 채운다 (월 제한이 있으면 그 횟수까지만) */
export function fillPlan(state: GameState, activityId: ActivityId): GameState {
  if (state.ui.phase !== "planning") return state;
  const def = getActivity(activityId);
  const next = clone(state);
  next.ui.plan = new Array<ActivityId | null>(WEEKS_PER_MONTH).fill(null);
  const limit = typeof def.maxPerMonth === "number" ? def.maxPerMonth : WEEKS_PER_MONTH;
  if (hardBlockReason(next, def)) return state;
  for (let i = 0; i < Math.min(WEEKS_PER_MONTH, limit); i += 1) {
    next.ui.plan[i] = activityId;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function getPlanPreview(state: GameState): PlanPreview {
  const problems: string[] = [];
  let money = 0;
  let stamina = 0;
  let stress = 0;
  let runningMoney = state.economy.money;

  state.ui.plan.forEach((slot, index) => {
    if (!slot) {
      problems.push(`${index + 1}주차가 비어 있다`);
      stamina += B.WEEKLY_STAMINA_RECOVERY;
      return;
    }
    const def = getActivity(slot);
    const hard = hardBlockReason(state, def, index);
    if (hard) problems.push(`${index + 1}주차 ${def.label}: ${hard}`);
    const delta = estimateMoneyDelta(state, def);
    money += delta;
    runningMoney += delta;
    if (runningMoney < B.MONEY_MIN) {
      problems.push(`${index + 1}주차 ${def.label}: 자금이 모자란다`);
      runningMoney = B.MONEY_MIN;
    }
    stamina += B.WEEKLY_STAMINA_RECOVERY + staminaDeltaOf(state, def);
    stress += stressDeltaOf(state, def);
  });

  // 같은 활동이 월 제한을 넘는지 (슬롯 단위 검사에서 놓치는 조합)
  const counts = new Map<ActivityId, number>();
  for (const slot of state.ui.plan) {
    if (!slot) continue;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    const def = getActivity(id);
    if (typeof def.maxPerMonth === "number" && count > def.maxPerMonth) {
      problems.push(`${def.label}: 한 달 ${def.maxPerMonth}회까지만 가능`);
    }
  }

  return { money, stamina, stress, valid: problems.length === 0, problems };
}

/** 계획 실행 가능 여부 (자금 부족은 실행을 막지 않고 해당 주차만 취소된다) */
export function validatePlan(state: GameState): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  state.ui.plan.forEach((slot, index) => {
    if (!slot) {
      problems.push(`${index + 1}주차가 비어 있다`);
      return;
    }
    const def = getActivity(slot);
    const hard = hardBlockReason(state, def, index);
    if (hard) problems.push(`${index + 1}주차 ${def.label}: ${hard}`);
  });
  const counts = new Map<ActivityId, number>();
  for (const slot of state.ui.plan) {
    if (!slot) continue;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    const def = getActivity(id);
    if (typeof def.maxPerMonth === "number" && count > def.maxPerMonth) {
      problems.push(`${def.label}: 한 달 ${def.maxPerMonth}회까지만 가능`);
    }
  }
  return { ok: problems.length === 0, problems };
}

export function getTrainerUpgradeCost(state: GameState): number | null {
  if (state.economy.trainerTier >= B.TRAINER_MAX_TIER) return null;
  const nextTier = (state.economy.trainerTier + 1) as 2 | 3;
  return B.TRAINER_UPGRADE_COST[nextTier];
}

export function upgradeTrainer(state: GameState): GameState {
  const cost = getTrainerUpgradeCost(state);
  if (cost === null) return state;
  if (state.economy.money < cost) return state;
  const next = clone(state);
  next.economy.money -= cost;
  next.economy.trainerTier = (next.economy.trainerTier + 1) as 2 | 3;
  next.updatedAt = new Date().toISOString();
  return next;
}
