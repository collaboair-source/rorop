/** GDD 14절 밸런스 검증 시나리오를 자동 플레이로 재현한다 */

import { describe, expect, it } from "vitest";

import * as E from "../engine";
import {
  BACKGROUND_IDS,
  CORE_SKILL_IDS,
  ENDING_IDS,
  PERSONALITY_IDS,
  TOTAL_MONTHS,
  type ActivityId,
  type CoreSkillId,
  type GameState,
} from "../types";
import { budgetedPlan, newGame, playToEnd, runMonths } from "./helpers";

// ---------------------------------------------------------------------------
// (a) 알바만 반복 → 24개월차 계약 종료
// ---------------------------------------------------------------------------

const jobPlanner = () =>
  ["job_convenience", "job_cafe", "job_convenience", "rest"] as ActivityId[];

describe("시나리오 A · 알바만 반복", () => {
  it("자금은 늘지만 24개월차 월말에 contract_terminated 로 끝난다", () => {
    const start = newGame({ seed: 1001, background: "vocal_prodigy", personality: "diligent" });
    const end = playToEnd(start, { planner: jobPlanner });

    expect(end.ui.phase).toBe("ended");
    expect(end.ending?.id).toBe("contract_terminated");
    expect(end.ending?.month).toBe(24);
    expect(end.career.debuted).toBe(false);
    expect(end.economy.money).toBeGreaterThan(start.economy.money);
    expect(E.getCoreAverage(end)).toBeLessThan(40);
  });
});

// ---------------------------------------------------------------------------
// (b) 휴식 없이 훈련만 4슬롯 → 위기 이벤트
// ---------------------------------------------------------------------------

const trainOnlyPlanner = () =>
  ["practice_vocal", "practice_dance", "practice_rap", "practice_dance"] as ActivityId[];

describe("시나리오 B · 휴식 없이 훈련만", () => {
  it("몇 달 안에 E32(쓰러짐) 또는 E31(한계)가 강제로 발생한다", () => {
    const start = newGame({ seed: 2002, background: "dance_academy", personality: "perfectionist" });
    const after = runMonths(start, 6, { planner: trainOnlyPlanner });

    const collapsed = after.seenEvents.stamina_collapse?.count ?? 0;
    const broke = after.seenEvents.stress_break?.count ?? 0;
    expect(collapsed + broke).toBeGreaterThan(0);
  });

  it("첫 위기는 5개월차 안에 온다", () => {
    const start = newGame({ seed: 2002, background: "dance_academy", personality: "perfectionist" });
    const after = runMonths(start, 5, { planner: trainOnlyPlanner });
    const first = Math.min(
      after.seenEvents.stamina_collapse?.lastMonth ?? 99,
      after.seenEvents.stress_break?.lastMonth ?? 99,
    );
    expect(first).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// (c) 보컬 중심 육성 + 발라드/보컬 컴백 → 36개월차 보컬 85 이상
// ---------------------------------------------------------------------------

/** 능력치별 훈련 후보 (앞이 우선, 마지막은 비용 0인 최후 대체) */
const CORE_TRAINING: Record<CoreSkillId, ActivityId[]> = {
  vocal: ["lesson_vocal", "practice_vocal"],
  dance: ["lesson_dance", "practice_dance"],
  rap: ["lesson_rap", "practice_rap"],
  visual: ["styling", "fitness", "practice_rap"],
  variety: ["lesson_variety", "sns_content", "practice_rap"],
};

const VOCAL_SLOT: ActivityId[] = ["lesson_vocal", "practice_vocal"];
const JOB_SLOT: ActivityId[] = ["job_convenience", "job_cafe", "practice_vocal"];
const FANS_SLOT: ActivityId[] = ["busking", "sns_content", "practice_vocal"];

/** 보컬을 제외한 코어 능력치를 낮은 순으로 */
function lowestCores(state: GameState): CoreSkillId[] {
  return CORE_SKILL_IDS.filter((id) => id !== "vocal")
    .slice()
    .sort((a, b) => state.idol.skills[a] - state.idol.skills[b]);
}

/**
 * 보컬 몰빵 빌드. 3슬롯 훈련 + 1슬롯 휴식을 유지하되,
 * 데뷔 조건(코어 평균 40 · 팬 3,000)을 채우기 전에는 가장 낮은 코어와 팬을 최소한만 보강한다.
 */
function vocalFocusPlanner(state: GameState): ActivityId[] {
  if (state.career.debuted) {
    return budgetedPlan(state, [VOCAL_SLOT, VOCAL_SLOT, VOCAL_SLOT, ["rest"]]);
  }
  const needFans = state.idol.social.fans < 12_000;
  const vocalMaxed = state.idol.skills.vocal >= 90;
  const lows = lowestCores(state);
  const broke = state.economy.money < 60;

  const slot1 = vocalMaxed ? CORE_TRAINING[lows[0]] : VOCAL_SLOT;
  const slot2 = broke ? JOB_SLOT : CORE_TRAINING[lows[vocalMaxed ? 1 : 0]];
  const slot3 = needFans ? FANS_SLOT : CORE_TRAINING[lows[vocalMaxed ? 2 : 1]];
  return budgetedPlan(state, [slot1, slot2, slot3, ["rest"]]);
}

describe("시나리오 C · 보컬 몰빵 + 발라드 컴백", () => {
  it("36개월을 완주하고 보컬 85 이상에 도달한다", () => {
    const start = newGame({ seed: 3003, background: "vocal_prodigy", personality: "diligent" });
    const end = playToEnd(start, {
      planner: vocalFocusPlanner,
      // 코어 평균에 여유가 생겼을 때만 신청한다 (실패해도 2개월 뒤 재신청)
      shouldRequestDebut: (state) => E.getCoreAverage(state) >= 46,
      comeback: () => ({ concept: "ballad", focus: "vocal" }),
    });

    expect(end.ui.phase).toBe("ended");
    expect(end.ending?.month).toBe(36);
    expect(end.career.debuted).toBe(true);
    expect(end.idol.skills.vocal).toBeGreaterThanOrEqual(85);
    expect(end.career.comebacks.length).toBeGreaterThan(0);
    expect(end.career.comebacks.every((c) => c.concept === "ballad" && c.focus === "vocal")).toBe(true);
  });

  it("여러 시드에서도 36개월 완주와 보컬 85 이상이 재현된다", () => {
    for (const seed of [1, 42, 777, 20260904]) {
      const end = playToEnd(newGame({ seed, background: "vocal_prodigy", personality: "diligent" }), {
        planner: vocalFocusPlanner,
        shouldRequestDebut: (state) => E.getCoreAverage(state) >= 46,
        comeback: () => ({ concept: "ballad", focus: "vocal" }),
      });
      expect(end.ending?.month, `seed ${seed}`).toBe(36);
      expect(end.idol.skills.vocal, `seed ${seed}`).toBeGreaterThanOrEqual(85);
    }
  });

  it("6개월차에는 코어 평균이 모자라 데뷔 평가를 신청할 수 없다", () => {
    const start = newGame({ seed: 3003, background: "vocal_prodigy", personality: "diligent" });
    const atSix = runMonths(start, 5, { planner: vocalFocusPlanner, requestDebut: false });
    expect(atSix.month).toBe(6);
    const check = E.canRequestDebutEval(atSix);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("코어");
  });
});

// ---------------------------------------------------------------------------
// 전 조합 스모크 — 어떤 출신·성격으로도 게임이 막히지 않고 엔딩까지 간다
// ---------------------------------------------------------------------------

/** 균형 성장 + 홍보 꾸준히 */
function balancedPlanner(state: GameState): ActivityId[] {
  const lows = CORE_SKILL_IDS.slice().sort((a, b) => state.idol.skills[a] - state.idol.skills[b]);
  const train = (id: CoreSkillId): ActivityId[] => CORE_TRAINING[id];
  if (state.career.debuted) {
    return budgetedPlan(state, [
      ["music_show", "sns_content"],
      ["fansign", "sns_content"],
      train(lows[0]),
      ["rest"],
    ]);
  }
  return budgetedPlan(state, [
    train(lows[0]),
    train(lows[1]),
    ["busking", "sns_content", "job_convenience"],
    ["rest"],
  ]);
}

describe("전 조합 스모크", () => {
  it("출신 5 × 성격 4 = 20판이 모두 정상적으로 엔딩까지 간다", () => {
    const endings = new Set<string>();
    for (const background of BACKGROUND_IDS) {
      for (const personality of PERSONALITY_IDS) {
        const end = playToEnd(newGame({ seed: 8080, background, personality }), {
          planner: balancedPlanner,
        });
        expect(end.ui.phase, `${background}/${personality}`).toBe("ended");
        expect(end.ending, `${background}/${personality}`).not.toBeNull();
        expect(ENDING_IDS as readonly string[]).toContain(end.ending?.id ?? "");
        expect(end.month).toBeLessThanOrEqual(TOTAL_MONTHS);
        expect(end.idol.social.fans).toBeGreaterThanOrEqual(0);
        expect(end.economy.money).toBeGreaterThanOrEqual(0);
        endings.add(end.ending?.id ?? "");
      }
    }
    expect(endings.size).toBeGreaterThan(1);
  });
});
