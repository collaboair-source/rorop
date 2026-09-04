import { describe, expect, it } from "vitest";

import * as E from "../engine";
import { matchesRequirement, rollWeekEvent } from "../engine/events";
import { EVENTS } from "../data/events";
import type { ActivityId, GameState } from "../types";
import { advance, forcePlan, mutate, newGame, runMonths } from "./helpers";

const restPlanner = () => ["rest", "rest", "rest", "rest"] as ActivityId[];

function startWith(state: GameState, plan: ActivityId[]): GameState {
  return E.startMonth(forcePlan(state, plan));
}

/** 목표 이벤트가 뜰 때까지 진행하며, 다른 이벤트는 첫 선택지로 넘긴다 */
function stepUntil(state: GameState, predicate: (s: GameState) => boolean, limit = 40): GameState {
  let current = state;
  for (let i = 0; i < limit; i += 1) {
    if (predicate(current)) return current;
    if (current.ui.phase === "event") {
      const event = E.getCurrentEvent(current);
      if (!event) throw new Error("이벤트 정의 없음");
      current = E.chooseOption(current, event.choices[0].id);
      continue;
    }
    if (current.ui.phase === "resolving") {
      current = E.step(current);
      continue;
    }
    break;
  }
  if (!predicate(current)) throw new Error(`조건에 도달하지 못했다: ${current.ui.phase}`);
  return current;
}

describe("고정 이벤트", () => {
  it("first_evaluation 은 3개월차 1주차에 발생한다", () => {
    let state = newGame({ seed: 2024 });
    state = runMonths(state, 2, { planner: restPlanner });
    expect(state.month).toBe(3);
    const started = startWith(state, ["rest", "rest", "rest", "rest"]);
    const after = E.step(started);
    expect(after.ui.phase).toBe("event");
    expect(after.ui.pendingEventId).toBe("first_evaluation");
    expect(after.ui.weekIndex).toBe(0);
    expect(E.getCurrentEvent(after)?.title).toBe("첫 월말 평가");
  });

  it("선택지 효과가 적용되고 다음 주로 넘어간다", () => {
    let state = newGame({ seed: 2024 });
    state = runMonths(state, 2, { planner: restPlanner });
    const evented = E.step(startWith(state, ["rest", "rest", "rest", "rest"]));
    const bondBefore = evented.idol.social.bond;
    const chosen = E.chooseOption(evented, "honest");
    expect(chosen.idol.social.bond).toBe(bondBefore + 3);
    expect(chosen.ui.phase).toBe("resolving");
    expect(chosen.ui.weekIndex).toBe(1);
    expect(chosen.seenEvents.first_evaluation.count).toBe(1);
  });

  it("gift 는 6·12·18·24·30개월차에 잡혀 있다", () => {
    const gift = EVENTS.find((e) => e.id === "gift");
    expect(gift?.trigger.month).toEqual([6, 12, 18, 24, 30]);
  });
});

describe("once / cooldown", () => {
  it("once 이벤트는 회차당 한 번만 발생한다", () => {
    const state = runMonths(newGame({ seed: 77 }), 20, {
      planner: () => ["sns_content", "practice_vocal", "rest", "job_cafe"] as ActivityId[],
    });
    for (const def of EVENTS) {
      if (!def.trigger.once) continue;
      const seen = state.seenEvents[def.id];
      if (!seen) continue;
      expect(seen.count, `${def.id} 가 ${seen.count}회 발생`).toBe(1);
    }
  });

  it("cooldown 안에서는 재발하지 않는다", () => {
    const base = mutate(newGame({ background: "vocal_prodigy" }), (d) => {
      d.month = 5;
      d.ui.phase = "resolving";
      d.ui.plan = ["sns_content", null, null, null];
    });

    const blocked = mutate(base, (d) => {
      d.seenEvents.sns_viral = { count: 1, lastMonth: 4 };
    });
    const allowed = mutate(base, (d) => {
      d.seenEvents.sns_viral = { count: 1, lastMonth: 1 };
    });

    let blockedHits = 0;
    let allowedHits = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      const b = structuredClone(blocked);
      b.rngState = seed * 7919;
      if (rollWeekEvent(b, 0)?.id === "sns_viral") blockedHits += 1;

      const a = structuredClone(allowed);
      a.rngState = seed * 7919;
      if (rollWeekEvent(a, 0)?.id === "sns_viral") allowedHits += 1;
    }
    expect(blockedHits).toBe(0);
    expect(allowedHits).toBeGreaterThan(0);
  });
});

describe("위기 규칙", () => {
  it("체력이 0 이하가 되면 E32(쓰러짐)가 강제로 발생한다", () => {
    const base = mutate(newGame({ seed: 5 }), (d) => {
      d.idol.condition.stamina = 5;
    });
    const after = E.step(startWith(base, ["practice_dance", "rest", "rest", "rest"]));
    expect(after.idol.condition.stamina).toBe(0);
    expect(after.ui.phase).toBe("event");
    expect(after.ui.pendingEventId).toBe("stamina_collapse");

    const healed = E.chooseOption(after, "hospital");
    expect(healed.idol.condition.stamina).toBe(60);
    expect(healed.ui.phase).toBe("resolving");
  });

  it("스트레스 100 · 호감도 40 이상이면 슬럼프로 회복한다", () => {
    const base = mutate(newGame({ seed: 5, background: "vocal_prodigy" }), (d) => {
      d.idol.condition.stress = 97;
      d.idol.social.bond = 60;
    });
    const after = E.step(startWith(base, ["practice_vocal", "rest", "rest", "rest"]));
    expect(after.idol.condition.stress).toBe(100);
    expect(after.ui.pendingEventId).toBe("stress_break");

    const held = E.chooseOption(after, "hold");
    expect(held.ending).toBeNull();
    expect(held.idol.condition.stress).toBe(50);
    expect(held.idol.condition.stamina).toBe(held.idol.condition.maxStamina);
    expect(held.idol.skills.vocal).toBeLessThan(after.idol.skills.vocal);
  });

  it("스트레스 100 · 호감도 40 미만이면 burnout_leave 엔딩", () => {
    const base = mutate(newGame({ seed: 5, background: "vocal_prodigy" }), (d) => {
      d.idol.condition.stress = 97;
      d.idol.social.bond = 10;
    });
    const after = E.step(startWith(base, ["practice_vocal", "rest", "rest", "rest"]));
    const held = E.chooseOption(after, "hold");
    expect(held.ending?.id).toBe("burnout_leave");
    expect(held.ui.phase).toBe("ended");
  });

  it("놓아주면 곧바로 burnout_leave 엔딩", () => {
    const base = mutate(newGame({ seed: 5 }), (d) => {
      d.idol.condition.stress = 97;
      d.idol.social.bond = 90;
    });
    const after = E.step(startWith(base, ["practice_vocal", "rest", "rest", "rest"]));
    const released = E.chooseOption(after, "release");
    expect(released.ending?.id).toBe("burnout_leave");
  });

  it("평판이 10 이하가 되면 즉시 scandal_fall", () => {
    const base = mutate(newGame({ seed: 5 }), (d) => {
      d.idol.social.reputation = 10;
    });
    const after = E.step(startWith(base, ["rest", "rest", "rest", "rest"]));
    expect(after.ending?.id).toBe("scandal_fall");
    expect(after.ui.phase).toBe("ended");
  });
});

describe("월 이벤트 제한", () => {
  it("고정·강제 이벤트를 뺀 이벤트는 한 달에 2개까지", () => {
    let state = newGame({ seed: 909, background: "street_cast" });
    for (let i = 0; i < 400; i += 1) {
      if (state.ui.phase === "ended") break;
      state = advance(state, {
        planner: () => ["sns_content", "sns_content", "sns_content", "rest"] as ActivityId[],
      });
      expect(state.ui.eventsThisMonth).toBeLessThanOrEqual(2);
    }
  });
});

describe("Requirement 해석", () => {
  it("minStamina/maxStamina 는 '현재 체력'의 하한/상한이다", () => {
    const tired = mutate(newGame(), (d) => {
      d.idol.condition.stamina = 20;
    });
    const fresh = mutate(newGame(), (d) => {
      d.idol.condition.stamina = 90;
    });
    expect(matchesRequirement(tired, { maxStamina: 24 })).toBe(true);
    expect(matchesRequirement(fresh, { maxStamina: 24 })).toBe(false);
    expect(matchesRequirement(fresh, { minStamina: 50 })).toBe(true);
  });

  it("anySkills 는 하나만 만족해도 통과한다", () => {
    const state = newGame({ background: "vocal_prodigy" });
    expect(matchesRequirement(state, { anySkills: { vocal: 50, dance: 90 } })).toBe(true);
    expect(matchesRequirement(state, { anySkills: { vocal: 90, dance: 90 } })).toBe(false);
    expect(matchesRequirement(state, { minSkills: { vocal: 50, dance: 90 } })).toBe(false);
  });

  it("E05(발목 부상)는 체력 25 미만에서만 후보가 된다", () => {
    const def = EVENTS.find((e) => e.id === "dance_injury");
    expect(def?.trigger.when?.maxStamina).toBe(24);
  });
});

describe("월말 이벤트 (E33 생활고)", () => {
  it("연습생 월말 자금이 30 미만이면 발생하고, 가불로 자금을 채운다", () => {
    const poor = mutate(newGame({ seed: 31 }), (d) => {
      d.economy.money = 0;
      d.month = 2;
    });
    const started = startWith(poor, ["rest", "rest", "rest", "rest"]);
    const atCrisis = stepUntil(started, (s) => s.ui.pendingEventId === "money_crisis");
    expect(atCrisis.ui.pendingMonthEnd).toBe(true);

    const moneyBefore = atCrisis.economy.money;
    const after = E.chooseOption(atCrisis, "advance");
    expect(after.economy.money).toBe(moneyBefore + 100);
    expect(after.economy.debtMonthsLeft).toBe(4);
    expect(after.ui.phase).toBe("report");
    expect(after.ui.report?.month).toBe(2);
  });
});
