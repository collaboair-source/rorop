/**
 * 테스트용 자동 진행 헬퍼.
 * 엔진의 phase 를 따라가며 계획 → 실행 → 이벤트 → 리포트 → 컴백/시상식을 자동으로 처리한다.
 */

import * as E from "../engine";
import { getActivity } from "../data/activities";
import { estimateMoneyDelta } from "../engine/resolve";
import type {
  ActivityId,
  ComebackFocus,
  ConceptId,
  GameEventDef,
  GameState,
  NewGameConfig,
} from "../types";

export interface AutoPlayOptions {
  /** 이번 달 4주 계획 */
  planner: (state: GameState) => Array<ActivityId | null>;
  /** 이벤트 선택지 결정 (기본: 첫 번째 선택지) */
  chooser?: (state: GameState, event: GameEventDef) => string;
  /** 조건이 되면 데뷔 평가를 신청할지 (기본 true) */
  requestDebut?: boolean;
  /** 신청 가능할 때 실제로 신청할지 판단 (기본: 항상 신청) */
  shouldRequestDebut?: (state: GameState) => boolean;
  /** 컴백 콘셉트·포커스 (기본: 청량 + 가장 높은 능력치) */
  comeback?: (state: GameState) => { concept: ConceptId; focus: ComebackFocus };
}

const MAX_STEPS = 5000;

export function newGame(overrides: Partial<NewGameConfig> = {}): GameState {
  return E.createGame({
    name: "서하람",
    background: "vocal_prodigy",
    personality: "diligent",
    seed: 12345,
    ...overrides,
  });
}

/** 테스트 편의: 상태를 복사해 직접 조작한다 (엔진 밖에서만 사용) */
export function mutate(state: GameState, fn: (draft: GameState) => void): GameState {
  const draft = structuredClone(state);
  fn(draft);
  return draft;
}

/** 조건 검사 없이 계획을 직접 채운다 (테스트 전용) */
export function forcePlan(state: GameState, ids: Array<ActivityId | null>): GameState {
  return mutate(state, (draft) => {
    draft.ui.plan = [ids[0] ?? null, ids[1] ?? null, ids[2] ?? null, ids[3] ?? null];
  });
}

/** 지금 실행 가능한 첫 활동을 고른다 (없으면 마지막 후보) */
export function pickAffordable(state: GameState, ...ids: ActivityId[]): ActivityId {
  const list = E.getAvailableActivities(state);
  for (const id of ids) {
    const found = list.find((item) => item.def.id === id);
    if (found?.available) return id;
  }
  return ids[ids.length - 1];
}

/**
 * 슬롯별 후보 목록에서 하드 조건과 누적 자금을 함께 보며 계획을 만든다.
 * 각 후보 목록의 마지막 항목은 비용 0인 활동이어야 한다(최후 대체).
 */
export function budgetedPlan(state: GameState, wishlist: ActivityId[][]): ActivityId[] {
  const availability = E.getAvailableActivities(state);
  let money = state.economy.money;
  const result: ActivityId[] = [];
  for (const candidates of wishlist) {
    let chosen = candidates[candidates.length - 1];
    for (const id of candidates) {
      const entry = availability.find((item) => item.def.id === id);
      if (!entry) continue;
      const blockedByMoney = entry.reason?.startsWith("자금 부족") ?? false;
      if (!entry.available && !blockedByMoney) continue;
      const cost = estimateMoneyDelta(state, getActivity(id));
      if (money + cost >= 0) {
        chosen = id;
        money += cost;
        break;
      }
    }
    result.push(chosen);
  }
  return result;
}

function defaultChooser(_state: GameState, event: GameEventDef): string {
  return event.choices[0].id;
}

function defaultComeback(state: GameState): { concept: ConceptId; focus: ComebackFocus } {
  const s = state.idol.skills;
  const focus: ComebackFocus =
    s.vocal >= s.dance && s.vocal >= s.rap ? "vocal" : s.dance >= s.rap ? "dance" : "rap";
  return { concept: "fresh", focus };
}

function signature(state: GameState): string {
  return [
    state.ui.phase,
    state.month,
    state.ui.weekIndex,
    state.ui.pendingEventId ?? "-",
    state.ui.lastComeback ? state.ui.lastComeback.month : "-",
    state.ui.lastDebutEval ? state.ui.lastDebutEval.month : "-",
    state.ending ? state.ending.id : "-",
  ].join("|");
}

/** phase 에 따라 한 단계 진행한다 */
export function advance(state: GameState, options: AutoPlayOptions): GameState {
  const chooser = options.chooser ?? defaultChooser;
  const comeback = options.comeback ?? defaultComeback;

  switch (state.ui.phase) {
    case "planning": {
      const wantsDebut = options.shouldRequestDebut ? options.shouldRequestDebut(state) : true;
      if (options.requestDebut !== false && wantsDebut && E.canRequestDebutEval(state).ok) {
        return E.requestDebutEval(state);
      }
      let next = state;
      const plan = options.planner(state);
      for (let i = 0; i < 4; i += 1) {
        next = E.setPlanSlot(next, i as 0 | 1 | 2 | 3, plan[i] ?? null);
      }
      const started = E.startMonth(next);
      if (started.ui.phase !== "resolving") {
        throw new Error(
          `계획을 시작할 수 없다 (month ${state.month}): ${E.validatePlan(next).problems.join(" / ")}`,
        );
      }
      return started;
    }
    case "debut_eval":
      return E.confirmDebutEval(state);
    case "resolving":
      return E.step(state);
    case "event": {
      const event = E.getCurrentEvent(state);
      if (!event) throw new Error("이벤트 정의를 찾을 수 없다");
      return E.chooseOption(state, chooser(state, event));
    }
    case "report":
      return E.confirmReport(state);
    case "comeback": {
      if (state.ui.lastComeback && state.ui.lastComeback.month === state.month) {
        return E.confirmComeback(state);
      }
      const choice = comeback(state);
      return E.chooseComeback(state, choice.concept, choice.focus);
    }
    case "award":
      return E.confirmAward(state);
    case "ended":
      return state;
  }
}

function step(state: GameState, options: AutoPlayOptions): GameState {
  const before = signature(state);
  const next = advance(state, options);
  if (signature(next) === before && next.ui.phase !== "ended") {
    throw new Error(`진행이 멈췄다: ${before}`);
  }
  return next;
}

/** 현재 달을 끝내고 다음 달 planning(또는 ended)까지 진행한다 */
export function runMonth(state: GameState, options: AutoPlayOptions): GameState {
  const startMonth = state.month;
  let current = state;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (current.ui.phase === "ended") return current;
    if (current.month > startMonth && current.ui.phase === "planning") return current;
    current = step(current, options);
  }
  throw new Error("runMonth: 스텝 한도 초과");
}

export function runMonths(state: GameState, count: number, options: AutoPlayOptions): GameState {
  let current = state;
  for (let i = 0; i < count; i += 1) {
    if (current.ui.phase === "ended") break;
    current = runMonth(current, options);
  }
  return current;
}

/** 엔딩이 날 때까지 자동 진행 */
export function playToEnd(state: GameState, options: AutoPlayOptions): GameState {
  let current = state;
  for (let i = 0; i < MAX_STEPS * 20; i += 1) {
    if (current.ui.phase === "ended") return current;
    current = step(current, options);
  }
  throw new Error("playToEnd: 스텝 한도 초과");
}

/** 타임스탬프를 지워 두 상태를 비교 가능하게 만든다 */
export function normalizeTimestamps(state: GameState): GameState {
  return mutate(state, (draft) => {
    draft.createdAt = "";
    draft.updatedAt = "";
  });
}
