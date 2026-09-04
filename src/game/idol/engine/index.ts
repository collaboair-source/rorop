/**
 * 엔진 공개 API (TECH_SPEC 4절). UI 는 이 파일만 import 한다.
 *
 * 모든 함수는 순수 함수다: 입력 상태를 변경하지 않고 새 상태를 반환한다.
 * 난수는 state.rngState 에서만 꺼내 갱신값을 새 상태에 넣는다 (Math.random 미사용).
 */

import { TOTAL_MONTHS, WEEKS_PER_MONTH } from "../types";
import type {
  ActivityId,
  ComebackFocus,
  ConceptId,
  EndingId,
  GameState,
  StatDelta,
} from "../types";
import { getActivity } from "../data/activities";
import { getEventDef } from "./events";
import {
  applyComeback,
  applyDebutEval,
  canRequestDebutEval,
  grantAwards,
  isAwardMonth,
  updatePhase,
} from "./career";
import { checkImmediateEnding, finishGame, judgeEnding, setEnding } from "./endings";
import { checkStatValue, forcedEventId, markEventFired, rollWeekEvent } from "./events";
import { advanceToNextMonth, completeMonthEnd, finishMonth } from "./month";
import { hardBlockReason, validatePlan } from "./plan";
import { applyDelta, resolveWeek, snapshotOf } from "./resolve";
import * as B from "../balance";

// --- 재수출 ------------------------------------------------------------------

export { createGame } from "./create";
export {
  fillPlan,
  getAvailableActivities,
  getPlanPreview,
  getTrainerUpgradeCost,
  setPlanSlot,
  upgradeTrainer,
  validatePlan,
  type ActivityAvailability,
  type PlanPreview,
} from "./plan";
export { canRequestDebutEval, isAwardMonth } from "./career";
export {
  getBondTier,
  getCoreAverage,
  getCurrentEvent,
  getEmotion,
  getEndingDef,
  getIdolLine,
  getMood,
  getPortraitStage,
} from "./selectors";
export { judgeEnding } from "./endings";
export { formatFans } from "./resolve";

// --- 내부 헬퍼 ---------------------------------------------------------------

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function touch(state: GameState): GameState {
  state.updatedAt = new Date().toISOString();
  return state;
}

function setPendingEvent(draft: GameState, eventId: string): void {
  const def = getEventDef(eventId);
  if (!def) return;
  markEventFired(draft, def);
  draft.ui.pendingEventId = def.id;
  draft.ui.lastChoiceText = null;
  draft.ui.phase = "event";
}

/** 데뷔 등으로 조건이 바뀌었을 때 더 이상 불가능한 슬롯을 비운다 */
function pruneInvalidPlan(draft: GameState): void {
  draft.ui.plan = draft.ui.plan.map((slot, index) => {
    if (!slot) return null;
    return hardBlockReason(draft, getActivity(slot), index) ? null : slot;
  });
}

function goToNextMonthPhase(draft: GameState): void {
  advanceToNextMonth(draft);
  draft.ui.phase = draft.career.nextComebackMonth === draft.month ? "comeback" : "planning";
}

// --- 실행 --------------------------------------------------------------------

/** 계획 검증 후 phase → 'resolving' */
export function startMonth(state: GameState): GameState {
  if (state.ui.phase !== "planning") return state;
  if (!validatePlan(state).ok) return state;
  const draft = clone(state);
  draft.ui.phase = "resolving";
  draft.ui.weekIndex = 0;
  draft.ui.log = [];
  draft.ui.eventsThisMonth = 0;
  draft.ui.pendingEventId = null;
  draft.ui.lastChoiceText = null;
  draft.ui.pendingMonthEnd = false;
  // 월 시작 스냅샷을 리포트 뼈대에 담아 둔다 (월말에 after/ledger 를 채운다)
  const before = snapshotOf(draft);
  draft.ui.report = {
    month: draft.month,
    before,
    after: before,
    ledger: [],
    idolLine: "",
    emotion: "neutral",
    notices: [],
  };
  return touch(draft);
}

/** 한 주 해결. 이벤트 발생 시 phase → 'event'. 4주 완료 시 월말 처리 후 phase → 'report' */
export function step(state: GameState): GameState {
  if (state.ui.phase !== "resolving") return state;
  const draft = clone(state);
  const weekIndex = draft.ui.weekIndex;

  if (weekIndex >= WEEKS_PER_MONTH) {
    finishMonth(draft);
    checkImmediateEnding(draft);
    return touch(draft);
  }

  resolveWeek(draft, weekIndex);
  if (checkImmediateEnding(draft)) return touch(draft);

  const forced = forcedEventId(draft);
  if (forced) {
    setPendingEvent(draft, forced);
    return touch(draft);
  }

  const event = rollWeekEvent(draft, weekIndex);
  if (event) {
    setPendingEvent(draft, event.id);
    return touch(draft);
  }

  draft.ui.weekIndex = weekIndex + 1;
  if (draft.ui.weekIndex >= WEEKS_PER_MONTH) {
    finishMonth(draft);
    checkImmediateEnding(draft);
  }
  return touch(draft);
}

/** phase 'event' → 효과 적용 → 'resolving' (엔딩이면 'ended', 월말 이벤트였다면 'report') */
export function chooseOption(state: GameState, choiceId: string): GameState {
  if (state.ui.phase !== "event") return state;
  const def = getEventDef(state.ui.pendingEventId);
  if (!def) return state;
  const choice = def.choices.find((c) => c.id === choiceId);
  if (!choice) return state;

  const draft = clone(state);
  const texts: string[] = [];
  let endingId = choice.endingId ?? null;

  // 판정 수치는 선택지 효과 적용 전 상태로 본다
  const checkPassed = choice.check ? checkStatValue(draft, choice.check.stat) >= choice.check.min : null;

  applyDelta(draft, choice.effects);
  if (choice.resultText) texts.push(choice.resultText);

  if (choice.check && checkPassed !== null) {
    const branch = checkPassed ? choice.check.success : choice.check.failure;
    applyDelta(draft, branch.effects);
    texts.push(branch.text);
    if (!checkPassed && choice.check.failure.endingId) endingId = choice.check.failure.endingId;
  }

  const week = Math.min(WEEKS_PER_MONTH, draft.ui.weekIndex + 1);
  draft.ui.lastChoiceText = texts.join("\n");
  const deltas: StatDelta = choice.effects;
  draft.ui.log.push({
    week,
    kind: "event",
    text: `${def.title} — ${texts.join(" ")}`,
    deltas,
  });
  draft.ui.pendingEventId = null;

  if (endingId) {
    setEnding(draft, endingId);
    return touch(draft);
  }
  if (checkImmediateEnding(draft)) return touch(draft);
  updatePhase(draft);

  // 위기 규칙 연쇄 (E32 처리 직후 스트레스 100 이면 E31)
  const forced = forcedEventId(draft);
  if (forced) {
    setPendingEvent(draft, forced);
    return touch(draft);
  }

  if (draft.ui.pendingMonthEnd) {
    completeMonthEnd(draft);
    checkImmediateEnding(draft);
    return touch(draft);
  }

  draft.ui.weekIndex += 1;
  if (draft.ui.weekIndex >= WEEKS_PER_MONTH) {
    finishMonth(draft);
    checkImmediateEnding(draft);
  } else {
    draft.ui.phase = "resolving";
  }
  return touch(draft);
}

/**
 * 'report' → 다음 단계.
 * 우선순위: 조기 엔딩 > 36개월차 종료(시상식 → 엔딩) > 시상식(12/24) > 계약 종료(24개월차 미데뷔) > 컴백/계획
 */
export function confirmReport(state: GameState): GameState {
  if (state.ui.phase !== "report") return state;
  const draft = clone(state);
  if (checkImmediateEnding(draft)) return touch(draft);

  if (draft.month >= TOTAL_MONTHS) {
    if (draft.career.debuted) {
      draft.ui.lastAwards = grantAwards(draft);
      draft.ui.phase = "award";
      return touch(draft);
    }
    finishGame(draft);
    return touch(draft);
  }

  if (isAwardMonth(draft.month) && draft.career.debuted) {
    draft.ui.lastAwards = grantAwards(draft);
    draft.ui.phase = "award";
    return touch(draft);
  }

  if (draft.month >= B.CONTRACT_DEADLINE_MONTH && !draft.career.debuted) {
    setEnding(draft, "contract_terminated");
    return touch(draft);
  }

  goToNextMonthPhase(draft);
  return touch(draft);
}

// --- 데뷔 평가 ---------------------------------------------------------------

/** phase → 'debut_eval', ui.lastDebutEval 설정 */
export function requestDebutEval(state: GameState): GameState {
  if (!canRequestDebutEval(state).ok) return state;
  const draft = clone(state);
  applyDebutEval(draft);
  draft.ui.phase = "debut_eval";
  return touch(draft);
}

/** → 'planning' */
export function confirmDebutEval(state: GameState): GameState {
  if (state.ui.phase !== "debut_eval") return state;
  const draft = clone(state);
  pruneInvalidPlan(draft);
  draft.ui.phase = "planning";
  return touch(draft);
}

// --- 커리어 ------------------------------------------------------------------

/** 컴백 결과 계산, ui.lastComeback 설정 (phase 유지) */
export function chooseComeback(state: GameState, concept: ConceptId, focus: ComebackFocus): GameState {
  if (state.ui.phase !== "comeback") return state;
  if (state.ui.lastComeback && state.ui.lastComeback.month === state.month) return state;
  const draft = clone(state);
  applyComeback(draft, concept, focus);
  checkImmediateEnding(draft);
  return touch(draft);
}

/** → 'award'(대기 중인 시상식이 있으면) | 'planning' */
export function confirmComeback(state: GameState): GameState {
  if (state.ui.phase !== "comeback") return state;
  if (!state.ui.lastComeback || state.ui.lastComeback.month !== state.month) return state;
  const draft = clone(state);
  if (draft.ui.lastAwards.length > 0) {
    draft.ui.phase = "award";
    return touch(draft);
  }
  pruneInvalidPlan(draft);
  draft.ui.phase = "planning";
  return touch(draft);
}

/** → 'ended'(36개월차) | 다음 달 'comeback' | 'planning' */
export function confirmAward(state: GameState): GameState {
  if (state.ui.phase !== "award") return state;
  const draft = clone(state);
  if (draft.month >= TOTAL_MONTHS) {
    finishGame(draft);
    return touch(draft);
  }
  goToNextMonthPhase(draft);
  return touch(draft);
}

// --- 조회 --------------------------------------------------------------------

export function getEndingId(state: GameState): EndingId | null {
  return state.ending ? state.ending.id : null;
}

/** 아직 엔딩이 없을 때 "지금 끝나면 어떤 엔딩인지" (도감 힌트용) */
export function previewEnding(state: GameState): EndingId {
  return judgeEnding(state);
}

export function isEnded(state: GameState): boolean {
  return state.ui.phase === "ended" || state.ending !== null;
}

export function getWeekActivity(state: GameState, weekIndex: number): ActivityId | null {
  return state.ui.plan[weekIndex] ?? null;
}
