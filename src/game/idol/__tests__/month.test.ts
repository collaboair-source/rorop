import { describe, expect, it } from "vitest";

import * as E from "../engine";
import { settleMonth } from "../engine/month";
import type { ActivityId, GameState } from "../types";
import { forcePlan, mutate, newGame, runMonth } from "./helpers";

function debutedState(fans: number, plan: Array<ActivityId | null> = [null, null, null, null]): GameState {
  return mutate(newGame(), (d) => {
    d.month = 10;
    d.career.debuted = true;
    d.career.debutMonth = 6;
    d.career.phase = "rookie";
    d.idol.social.fans = fans;
    d.ui.plan = [plan[0] ?? null, plan[1] ?? null, plan[2] ?? null, plan[3] ?? null];
  });
}

function amountOf(ledger: Array<{ label: string; amount: number }>, label: string): number | undefined {
  return ledger.find((entry) => entry.label === label)?.amount;
}

describe("월말 정산", () => {
  it("연습생은 지원금 +40, 숙소비 −20", () => {
    const draft = structuredClone(newGame());
    const before = draft.economy.money;
    const ledger = settleMonth(draft);
    expect(amountOf(ledger.entries, "회사 지원금")).toBe(40);
    expect(amountOf(ledger.entries, "숙소비")).toBe(-20);
    expect(draft.economy.money).toBe(before + 20);
  });

  it("지원 삭감 중에는 +20 이고 카운터가 줄어든다", () => {
    const draft = structuredClone(
      mutate(newGame(), (d) => {
        d.economy.supportCutMonthsLeft = 3;
      }),
    );
    const ledger = settleMonth(draft);
    expect(amountOf(ledger.entries, "회사 지원금 (삭감)")).toBe(20);
    expect(draft.economy.supportCutMonthsLeft).toBe(2);
  });

  it("데뷔 후에는 지원금이 없고 팬 수익이 들어온다", () => {
    const draft = structuredClone(debutedState(100_000));
    const ledger = settleMonth(draft);
    expect(amountOf(ledger.entries, "회사 지원금")).toBeUndefined();
    // min(1000, floor(100000/20000) × 10) = 50
    expect(amountOf(ledger.entries, "팬 수익")).toBe(50);
  });

  it("팬 수익은 1000만원에서 상한에 걸린다", () => {
    const draft = structuredClone(debutedState(50_000_000));
    const ledger = settleMonth(draft);
    expect(amountOf(ledger.entries, "팬 수익")).toBe(1000);
  });

  it("홍보 활동이 없으면 팬 −3%", () => {
    const draft = structuredClone(debutedState(100_000));
    settleMonth(draft);
    expect(draft.idol.social.fans).toBe(97_000);
  });

  it("홍보 활동이 하나라도 있으면 팬 +1%", () => {
    const draft = structuredClone(debutedState(100_000, ["fansign", null, null, null]));
    settleMonth(draft);
    expect(draft.idol.social.fans).toBe(101_000);
  });

  it("가불 상환은 매달 −30, 4개월이면 끝난다", () => {
    let draft = structuredClone(
      mutate(newGame(), (d) => {
        d.economy.money = 500;
        d.economy.debtMonthsLeft = 4;
      }),
    );
    for (let i = 4; i > 0; i -= 1) {
      const ledger = settleMonth(draft);
      expect(amountOf(ledger.entries, "가불 상환")).toBe(-30);
      expect(draft.economy.debtMonthsLeft).toBe(i - 1);
      draft = structuredClone(draft);
    }
    const ledger = settleMonth(draft);
    expect(amountOf(ledger.entries, "가불 상환")).toBeUndefined();
  });

  it("예능 고정 출연은 +100만원, 팬 +3%, 체력 −10", () => {
    const draft = structuredClone(
      mutate(debutedState(100_000, ["fansign", null, null, null]), (d) => {
        d.flags.variety_regular_until = 12;
        d.idol.condition.stamina = 80;
      }),
    );
    const ledger = settleMonth(draft);
    expect(amountOf(ledger.entries, "예능 고정 출연료")).toBe(100);
    // 팬 +3% → 103,000, 이후 홍보 보정 +1%
    expect(draft.idol.social.fans).toBe(104_030);
    expect(draft.idol.condition.stamina).toBe(70);
  });

  it("페이즈는 월말에 재계산된다", () => {
    const draft = structuredClone(debutedState(350_000, ["fansign", null, null, null]));
    settleMonth(draft);
    expect(draft.career.phase).toBe("rising");

    const star = structuredClone(debutedState(2_000_000, ["fansign", null, null, null]));
    settleMonth(star);
    expect(star.career.phase).toBe("star");
  });

  it("부상은 2개월 후 자연 회복된다", () => {
    let draft = structuredClone(
      mutate(newGame(), (d) => {
        d.idol.condition.injured = true;
        d.idol.condition.injuredMonthsLeft = 2;
      }),
    );
    settleMonth(draft);
    expect(draft.idol.condition.injured).toBe(true);
    expect(draft.idol.condition.injuredMonthsLeft).toBe(1);
    draft = structuredClone(draft);
    const ledger = settleMonth(draft);
    expect(draft.idol.condition.injured).toBe(false);
    expect(ledger.notices.join(" ")).toContain("자연 회복");
  });

  it("연습생 자금이 30 미만이면 low_money 플래그가 선다", () => {
    const draft = structuredClone(
      mutate(newGame(), (d) => {
        d.economy.money = 0;
      }),
    );
    settleMonth(draft);
    expect(draft.economy.money).toBe(20);
    expect(draft.flags.low_money).toBe(true);
  });
});

describe("월말 리포트", () => {
  it("리포트에 전/후 스냅샷과 대사가 담기고 history 에 쌓인다", () => {
    const state = runMonth(newGame({ seed: 4321 }), {
      planner: () => ["rest", "rest", "rest", "rest"] as ActivityId[],
    });
    expect(state.month).toBe(2);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].month).toBe(1);
  });

  it("report phase 에서 confirmReport 를 부르면 다음 달 planning 으로 간다", () => {
    let state = E.startMonth(forcePlan(newGame({ seed: 11 }), ["rest", "rest", "rest", "rest"]));
    for (let i = 0; i < 20 && state.ui.phase !== "report"; i += 1) {
      if (state.ui.phase === "event") {
        const event = E.getCurrentEvent(state);
        state = E.chooseOption(state, event ? event.choices[0].id : "");
      } else {
        state = E.step(state);
      }
    }
    expect(state.ui.phase).toBe("report");
    const report = state.ui.report;
    expect(report).not.toBeNull();
    expect(report?.month).toBe(1);
    expect(report?.idolLine.length).toBeGreaterThan(0);
    expect(report?.ledger.length).toBeGreaterThan(0);
    expect(report?.before.stamina).toBe(100);

    const next = E.confirmReport(state);
    expect(next.month).toBe(2);
    expect(next.ui.phase).toBe("planning");
    expect(next.ui.plan.every((slot) => slot === null)).toBe(true);
    expect(next.ui.log).toEqual([]);
  });
});
