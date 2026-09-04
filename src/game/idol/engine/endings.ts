/** 엔딩 판정 (GDD 11절, 8.5) */

import * as B from "../balance";
import { ENDINGS } from "../data/endings";
import type { EndingId, GameState } from "../types";

/** 36개월차 판정: 배열 순서대로 첫 매치 */
export function judgeEnding(state: GameState): EndingId {
  for (const def of ENDINGS) {
    if (def.condition(state)) return def.id;
  }
  return "ordinary_life";
}

/** 엔딩을 확정하고 phase 를 'ended' 로 만든다 */
export function setEnding(draft: GameState, id: EndingId): void {
  draft.ending = { id, month: draft.month };
  draft.ui.phase = "ended";
  draft.ui.pendingEventId = null;
  draft.ui.pendingMonthEnd = false;
}

/**
 * 엔진 규칙: 평판 ≤ 10 이면 즉시 scandal_fall (GDD 8.5 / E34 대체).
 * 엔딩이 확정되면 true.
 */
export function checkImmediateEnding(draft: GameState): boolean {
  if (draft.ending) return true;
  if (draft.idol.social.reputation <= B.SCANDAL_FALL_REPUTATION) {
    setEnding(draft, "scandal_fall");
    return true;
  }
  return false;
}

/** 36개월차 종료 처리 */
export function finishGame(draft: GameState): void {
  setEnding(draft, judgeEnding(draft));
}
