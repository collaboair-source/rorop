/** 조회 함수 — 상태를 바꾸지 않고 파생값만 계산한다 (UI 컴포넌트에서 직접 호출 가능) */

import * as B from "../balance";
import { DIALOGUE, type DialogueStage } from "../data/dialogue";
import { getEnding } from "../data/endings";
import { getEventDef } from "./events";
import { coreAverageOf } from "./resolve";
import type {
  Emotion,
  EndingDef,
  EndingId,
  GameEventDef,
  GameState,
  Mood,
  PortraitStage,
} from "../types";

const MOOD_ORDER: readonly Mood[] = ["stressed", "tired", "bonded", "happy", "neutral"];

export function getCoreAverage(state: GameState): number {
  return coreAverageOf(state.idol.skills);
}

/** 직전 달의 팬 증가율 (리포트가 있으면 이번 달, 없으면 history 마지막 두 달) */
export function lastFansGrowth(state: GameState): number {
  const report = state.ui.report;
  if (report && report.before.fans > 0 && report.after.fans !== report.before.fans) {
    return (report.after.fans - report.before.fans) / report.before.fans;
  }
  const h = state.history;
  if (h.length >= 2) {
    const prev = h[h.length - 2];
    const last = h[h.length - 1];
    if (prev.fans > 0) return (last.fans - prev.fans) / prev.fans;
  }
  return 0;
}

function hadGoodComeback(state: GameState): boolean {
  const last = state.ui.lastComeback;
  if (!last) return false;
  if (state.month - last.month > 1) return false;
  return last.rank === "top1" || last.rank === "top10";
}

/** GDD 10.2: stressed > tired > bonded > happy > neutral */
export function getMood(state: GameState): Mood {
  const c = state.idol.condition;
  if (c.stress >= B.MOOD_STRESS_LINE) return "stressed";
  if (c.stamina < B.MOOD_TIRED_STAMINA_LINE || c.injured) return "tired";
  if (state.idol.social.bond >= B.MOOD_BOND_LINE) return "bonded";
  if (lastFansGrowth(state) >= B.MOOD_HAPPY_FANS_PCT || hadGoodComeback(state)) return "happy";
  return "neutral";
}

export function getEmotion(state: GameState): Emotion {
  const c = state.idol.condition;
  if (c.stress >= B.MOOD_STRESS_LINE) return "sad";
  if (c.injured || c.stamina < B.MOOD_TIRED_STAMINA_LINE) return "tired";
  const mood = getMood(state);
  if (mood === "happy") return "excited";
  if (state.idol.social.bond >= B.MOOD_BOND_LINE) return "happy";
  const boost = state.flags.training_boost_until;
  if (typeof boost === "number" && boost >= state.month) return "determined";
  return "neutral";
}

export function getPortraitStage(state: GameState): PortraitStage {
  if (!state.career.debuted) return "trainee";
  return state.career.phase === "rookie" ? "rookie" : "star";
}

/** rng 를 소비하지 않고 월·무드로 결정적으로 고른다 */
export function getIdolLine(state: GameState): string {
  const stage: DialogueStage = state.career.debuted ? "debuted" : "trainee";
  const mood = getMood(state);
  const pool = DIALOGUE[stage][mood];
  const moodIndex = MOOD_ORDER.indexOf(mood);
  const index =
    (state.month * B.DIALOGUE_PICK_MONTH_MUL + moodIndex * B.DIALOGUE_PICK_MOOD_MUL) % pool.length;
  return pool[index];
}

export function getCurrentEvent(state: GameState): GameEventDef | null {
  return getEventDef(state.ui.pendingEventId);
}

export function getEndingDef(id: EndingId): EndingDef {
  return getEnding(id);
}

/** 호감도 구간 라벨 (GDD 10.1) */
export function getBondTier(state: GameState): 0 | 1 | 2 | 3 {
  const bond = state.idol.social.bond;
  if (bond >= B.BOND_TIER_LINES[2]) return 3;
  if (bond >= B.BOND_TIER_LINES[1]) return 2;
  if (bond >= B.BOND_TIER_LINES[0]) return 1;
  return 0;
}
