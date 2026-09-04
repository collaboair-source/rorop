import { describe, expect, it } from "vitest";

import { createGame } from "../engine";
import { BACKGROUNDS, getBackground } from "../data/backgrounds";
import { getPersonality } from "../data/personalities";
import { BACKGROUND_IDS, CONCEPT_IDS, PERSONALITY_IDS, TOTAL_MONTHS, WEEKS_PER_MONTH } from "../types";

/** GDD 2.3 표 원본 */
const EXPECTED = {
  street_cast: { skills: [15, 15, 10, 55, 20, 15], fans: 2000, money: 300, stress: 10, rep: 50, maxStamina: 100 },
  dance_academy: { skills: [20, 55, 15, 30, 20, 10], fans: 500, money: 300, stress: 10, rep: 50, maxStamina: 110 },
  vocal_prodigy: { skills: [55, 15, 10, 30, 15, 20], fans: 500, money: 300, stress: 10, rep: 50, maxStamina: 100 },
  underground_rapper: { skills: [20, 20, 55, 25, 25, 10], fans: 1500, money: 250, stress: 30, rep: 40, maxStamina: 100 },
  child_actor: { skills: [15, 10, 5, 35, 40, 50], fans: 10000, money: 500, stress: 10, rep: 50, maxStamina: 100 },
} as const;

describe("createGame", () => {
  it("출신별 초기 스탯이 GDD 표와 일치한다", () => {
    for (const id of BACKGROUND_IDS) {
      const state = createGame({ name: "서하람", background: id, personality: "diligent", seed: 1 });
      const e = EXPECTED[id];
      const s = state.idol.skills;
      expect([s.vocal, s.dance, s.rap, s.visual, s.variety, s.acting]).toEqual([...e.skills]);
      expect(state.idol.social.fans).toBe(e.fans);
      expect(state.economy.money).toBe(e.money);
      expect(state.idol.condition.stress).toBe(e.stress);
      expect(state.idol.social.reputation).toBe(e.rep);
      expect(state.idol.condition.maxStamina).toBe(e.maxStamina);
      expect(state.idol.condition.stamina).toBe(e.maxStamina);
      expect(state.idol.social.bond).toBe(20);
    }
  });

  it("재능 배수를 그대로 가져온다", () => {
    const state = createGame({ name: "A", background: "child_actor", personality: "diligent", seed: 1 });
    expect(state.idol.talents.acting).toBe(1.4);
    expect(state.idol.talents.variety).toBe(1.2);
    expect(state.idol.talents.rap).toBe(0.8);
  });

  it("콘셉트 적성 = 출신 기본값 + 성격 보너스", () => {
    for (const bg of BACKGROUND_IDS) {
      for (const pid of PERSONALITY_IDS) {
        const state = createGame({ name: "A", background: bg, personality: pid, seed: 1 });
        const base = getBackground(bg).conceptAffinity;
        const bonus = getPersonality(pid).conceptBonus;
        for (const cid of CONCEPT_IDS) {
          expect(state.idol.conceptAffinity[cid]).toBeCloseTo(base[cid] + (bonus[cid] ?? 0), 5);
        }
      }
    }
  });

  it("성격을 저장하고 초기 phase 는 planning 이다", () => {
    const state = createGame({ name: "서하람", background: "vocal_prodigy", personality: "optimist", seed: 7 });
    expect(state.idol.personality).toBe("optimist");
    expect(state.ui.phase).toBe("planning");
    expect(state.month).toBe(1);
    expect(state.ui.plan).toHaveLength(WEEKS_PER_MONTH);
    expect(state.ui.plan.every((slot) => slot === null)).toBe(true);
    expect(state.career.debuted).toBe(false);
    expect(state.career.phase).toBe("trainee");
    expect(state.ending).toBeNull();
    expect(state.history).toEqual([]);
  });

  it("게임 길이 상수는 36개월 × 4주다", () => {
    expect(TOTAL_MONTHS).toBe(36);
    expect(WEEKS_PER_MONTH).toBe(4);
  });

  it("시드를 주면 rngState 가 시드에서 시작한다", () => {
    const a = createGame({ name: "A", background: "street_cast", personality: "diligent", seed: 4242 });
    const b = createGame({ name: "A", background: "street_cast", personality: "diligent", seed: 4242 });
    expect(a.seed).toBe(4242);
    expect(a.rngState).toBe(b.rngState);
  });

  it("이름이 비면 기본 이름을 쓴다", () => {
    const state = createGame({ name: "   ", background: "street_cast", personality: "diligent", seed: 1 });
    expect(state.idol.name).toBe("서하람");
  });

  it("출신 데이터는 5종이다", () => {
    expect(BACKGROUNDS).toHaveLength(5);
  });
});
