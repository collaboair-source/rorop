import { describe, expect, it } from "vitest";

import type { ActivityId, GameState } from "../types";
import { budgetedPlan, newGame, normalizeTimestamps, runMonths } from "./helpers";

const planner = (state: GameState): ActivityId[] =>
  budgetedPlan(state, [
    ["lesson_vocal", "practice_vocal"],
    ["lesson_dance", "practice_dance"],
    ["sns_content", "practice_rap"],
    ["rest"],
  ]);

function play(seed: number, months: number): GameState {
  return runMonths(newGame({ seed }), months, { planner });
}

describe("결정성", () => {
  it("같은 시드·같은 계획으로 12개월을 두 번 진행하면 상태가 완전히 같다", () => {
    const a = normalizeTimestamps(play(20260904, 12));
    const b = normalizeTimestamps(play(20260904, 12));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.month).toBe(13);
  });

  it("시드가 다르면 결과가 달라진다", () => {
    const a = normalizeTimestamps(play(1, 12));
    const b = normalizeTimestamps(play(2, 12));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("rngState 는 매 진행마다 갱신되고 시드에서 출발한다", () => {
    const start = newGame({ seed: 4242 });
    expect(start.rngState).toBe(4242);
    const after = play(4242, 1);
    expect(after.rngState).not.toBe(4242);
  });

  it("36개월 완주도 두 번 돌리면 같은 엔딩·같은 최종 상태", () => {
    const a = normalizeTimestamps(runMonths(newGame({ seed: 7 }), 40, { planner }));
    const b = normalizeTimestamps(runMonths(newGame({ seed: 7 }), 40, { planner }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.ui.phase).toBe("ended");
    expect(a.ending).not.toBeNull();
  });
});
