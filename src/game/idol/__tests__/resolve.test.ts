import { describe, expect, it } from "vitest";

import * as E from "../engine";
import { dimOf } from "../engine/resolve";
import type { ActivityId, GameState } from "../types";
import { forcePlan, mutate, newGame } from "./helpers";

/** 1주차에 해당 활동을 넣고 한 주만 진행한다 */
function oneWeek(state: GameState, activityId: ActivityId): GameState {
  const planned = forcePlan(state, [activityId, "rest", "rest", "rest"]);
  const started = E.startMonth(planned);
  expect(started.ui.phase).toBe("resolving");
  return E.step(started);
}

describe("주차 해결", () => {
  it("보컬 레슨 1주: 보컬 증가, 자금 −30, 체력 −15, 스트레스 +6", () => {
    const base = newGame({ background: "vocal_prodigy", personality: "diligent" });
    const after = oneWeek(base, "lesson_vocal");

    expect(after.economy.money).toBe(300 - 30);
    // 자연 회복 +5 후 최대치(100) 로 클램프 → −15
    expect(after.idol.condition.stamina).toBe(85);
    expect(after.idol.condition.stress).toBe(16);
    expect(after.idol.skills.vocal).toBeGreaterThan(55);
    expect(after.idol.skills.vocal).toBeLessThan(60);
    expect(after.ui.log[0].text).toContain("보컬 레슨");
  });

  it("휴식: 체력 +40, 스트레스 −15 (회복 배수 1.0 성격 기준)", () => {
    const base = mutate(newGame({ personality: "perfectionist" }), (d) => {
      d.idol.condition.stamina = 40;
      d.idol.condition.stress = 50;
    });
    const after = oneWeek(base, "rest");
    // 자연 회복 +5 → 45, 휴식 +40 → 85
    expect(after.idol.condition.stamina).toBe(85);
    expect(after.idol.condition.stress).toBe(35);
    expect(after.economy.money).toBe(300);
  });

  it("자금이 부족한 활동은 getAvailableActivities 에서 불가로 표시된다", () => {
    const poor = mutate(newGame(), (d) => {
      d.economy.money = 10;
    });
    const list = E.getAvailableActivities(poor);
    const lesson = list.find((item) => item.def.id === "lesson_vocal");
    expect(lesson?.available).toBe(false);
    expect(lesson?.reason).toContain("자금 부족");
    const free = list.find((item) => item.def.id === "practice_vocal");
    expect(free?.available).toBe(true);
  });

  it("재능 배수가 성장량에 그대로 반영된다", () => {
    const base = newGame({ background: "vocal_prodigy" });
    const low = mutate(base, (d) => {
      d.idol.talents.vocal = 1.0;
    });
    const high = mutate(base, (d) => {
      d.idol.talents.vocal = 1.4;
    });
    const gainLow = oneWeek(low, "lesson_vocal").idol.skills.vocal - 55;
    const gainHigh = oneWeek(high, "lesson_vocal").idol.skills.vocal - 55;
    expect(gainHigh / gainLow).toBeCloseTo(1.4, 1);
  });

  it("트레이너 등급이 성장량과 레슨비에 반영된다", () => {
    const base = mutate(newGame({ background: "vocal_prodigy" }), (d) => {
      d.economy.money = 2000;
    });
    const tier1 = oneWeek(base, "lesson_vocal");
    const tier2State = mutate(base, (d) => {
      d.economy.trainerTier = 2;
    });
    const tier2 = oneWeek(tier2State, "lesson_vocal");

    const gain1 = tier1.idol.skills.vocal - 55;
    const gain2 = tier2.idol.skills.vocal - 55;
    expect(gain2 / gain1).toBeCloseTo(1.25, 1);
    // 레슨비 +10만원
    expect(tier1.economy.money).toBe(2000 - 30);
    expect(tier2.economy.money).toBe(2000 - 40);
  });

  it("dim 감쇠: 고레벨일수록 성장량이 작다", () => {
    const base = newGame({ background: "vocal_prodigy" });
    const lowSkill = mutate(base, (d) => {
      d.idol.skills.vocal = 20;
    });
    const highSkill = mutate(base, (d) => {
      d.idol.skills.vocal = 90;
    });
    const gainLow = oneWeek(lowSkill, "lesson_vocal").idol.skills.vocal - 20;
    const gainHigh = oneWeek(highSkill, "lesson_vocal").idol.skills.vocal - 90;
    expect(gainHigh).toBeLessThan(gainLow);
    expect(dimOf(90)).toBeLessThan(dimOf(20));
    expect(dimOf(200)).toBe(0.08);
  });

  it("체력 30 미만이면 훈련 효과 ×0.5", () => {
    const base = newGame({ background: "vocal_prodigy" });
    const healthy = mutate(base, (d) => {
      d.idol.condition.stamina = 100;
    });
    const tired = mutate(base, (d) => {
      d.idol.condition.stamina = 20;
    });
    const gainHealthy = oneWeek(healthy, "lesson_vocal").idol.skills.vocal - 55;
    const gainTired = oneWeek(tired, "lesson_vocal").idol.skills.vocal - 55;
    expect(gainTired / gainHealthy).toBeCloseTo(0.5, 1);
  });

  it("스트레스 70 이상이면 훈련 효과 ×0.7", () => {
    const base = newGame({ background: "vocal_prodigy", personality: "perfectionist" });
    const calm = mutate(base, (d) => {
      d.idol.condition.stress = 10;
    });
    const stressed = mutate(base, (d) => {
      d.idol.condition.stress = 80;
    });
    const gainCalm = oneWeek(calm, "lesson_vocal").idol.skills.vocal - 55;
    const gainStressed = oneWeek(stressed, "lesson_vocal").idol.skills.vocal - 55;
    expect(gainStressed / gainCalm).toBeCloseTo(0.7, 1);
  });

  it("부상 중이면 훈련 효과가 줄고 체력 소모가 늘어난다", () => {
    const base = newGame({ background: "vocal_prodigy" });
    const hurt = mutate(base, (d) => {
      d.idol.condition.injured = true;
      d.idol.condition.injuredMonthsLeft = 2;
    });
    const healthy = oneWeek(base, "lesson_vocal");
    const injured = oneWeek(hurt, "lesson_vocal");
    expect(injured.idol.skills.vocal - 55).toBeLessThan(healthy.idol.skills.vocal - 55);
    expect(injured.idol.condition.stamina).toBeLessThan(healthy.idol.condition.stamina);
  });

  it("피트니스는 최대 체력을 올린다", () => {
    const base = mutate(newGame(), (d) => {
      d.economy.money = 500;
    });
    const after = oneWeek(base, "fitness");
    expect(after.idol.condition.maxStamina).toBeCloseTo(101.5, 5);
  });

  it("버스킹은 팬을 늘리고 팁(랜덤 수입)을 준다", () => {
    const base = mutate(newGame({ background: "dance_academy" }), (d) => {
      d.idol.skills.dance = 50;
    });
    const after = oneWeek(base, "busking");
    expect(after.idol.social.fans).toBeGreaterThan(500);
    expect(after.economy.money).toBeGreaterThanOrEqual(300 + 5);
    expect(after.economy.money).toBeLessThanOrEqual(300 + 15);
    expect(after.idol.social.bond).toBeGreaterThan(20);
  });

  it("SNS 콘텐츠는 팬을 늘리고 소액을 쓴다", () => {
    const after = oneWeek(newGame({ background: "street_cast" }), "sns_content");
    expect(after.idol.social.fans).toBeGreaterThan(2000);
    expect(after.economy.money).toBe(300 - 5);
  });

  it("자금이 모자라면 그 주 활동은 취소된다", () => {
    const poor = mutate(newGame(), (d) => {
      d.economy.money = 0;
    });
    const after = oneWeek(poor, "lesson_vocal");
    expect(after.ui.log[0].text).toContain("취소");
    expect(after.idol.skills.vocal).toBe(55);
    expect(after.idol.condition.stamina).toBe(100);
  });

  it("계획 미리보기는 지출·체력·스트레스 합계를 알려준다", () => {
    let state = newGame({ background: "vocal_prodigy" });
    state = E.setPlanSlot(state, 0, "lesson_vocal");
    state = E.setPlanSlot(state, 1, "lesson_vocal");
    state = E.setPlanSlot(state, 2, "practice_vocal");
    state = E.setPlanSlot(state, 3, "rest");
    const preview = E.getPlanPreview(state);
    expect(preview.money).toBe(-60);
    expect(preview.valid).toBe(true);
    expect(preview.stress).toBeGreaterThan(0);
  });

  it("면담은 한 달에 한 번만 배치할 수 있다", () => {
    let state = newGame();
    state = E.setPlanSlot(state, 0, "counsel");
    state = E.setPlanSlot(state, 1, "counsel");
    expect(state.ui.plan[1]).toBeNull();
  });

  it("트레이너 업그레이드는 자금이 부족하면 원본을 반환한다", () => {
    const poor = mutate(newGame(), (d) => {
      d.economy.money = 100;
    });
    expect(E.upgradeTrainer(poor)).toBe(poor);
    const rich = mutate(poor, (d) => {
      d.economy.money = 1000;
    });
    const upgraded = E.upgradeTrainer(rich);
    expect(upgraded.economy.trainerTier).toBe(2);
    expect(upgraded.economy.money).toBe(700);
  });

  it("엔진 함수는 입력 상태를 변경하지 않는다", () => {
    const base = newGame({ background: "vocal_prodigy" });
    const before = JSON.stringify(base);
    oneWeek(base, "lesson_vocal");
    expect(JSON.stringify(base)).toBe(before);
  });
});
