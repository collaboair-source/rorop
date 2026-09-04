import { describe, expect, it } from "vitest";

import * as E from "../engine";
import { ENDINGS } from "../data/endings";
import { judgeEnding } from "../engine/endings";
import { CORE_SKILL_IDS, ENDING_IDS, TOTAL_MONTHS, type EndingId, type GameState } from "../types";
import { mutate, newGame } from "./helpers";

interface Shape {
  debuted?: boolean;
  fans?: number;
  bond?: number;
  reputation?: number;
  core?: number;
  vocal?: number;
  dance?: number;
  rap?: number;
  variety?: number;
  acting?: number;
}

function shaped(shape: Shape): GameState {
  return mutate(newGame(), (d) => {
    d.month = TOTAL_MONTHS;
    d.career.debuted = shape.debuted ?? true;
    d.career.phase = d.career.debuted ? "rookie" : "trainee";
    for (const id of CORE_SKILL_IDS) d.idol.skills[id] = shape.core ?? 30;
    d.idol.skills.acting = shape.acting ?? 20;
    if (shape.vocal !== undefined) d.idol.skills.vocal = shape.vocal;
    if (shape.dance !== undefined) d.idol.skills.dance = shape.dance;
    if (shape.rap !== undefined) d.idol.skills.rap = shape.rap;
    if (shape.variety !== undefined) d.idol.skills.variety = shape.variety;
    d.idol.social.fans = shape.fans ?? 1000;
    d.idol.social.bond = shape.bond ?? 30;
    d.idol.social.reputation = shape.reputation ?? 50;
  });
}

describe("36개월차 엔딩 판정", () => {
  it("partner_secret: 데뷔 + 호감도 95 + 팬 50만", () => {
    expect(judgeEnding(shaped({ bond: 95, fans: 500_000 }))).toBe("partner_secret");
  });

  it("partner_secret 은 world_star 보다 먼저 판정된다", () => {
    const both = shaped({ bond: 96, fans: 6_000_000, core: 85 });
    expect(judgeEnding(both)).toBe("partner_secret");
  });

  it("world_star: 팬 500만 + 코어 평균 80", () => {
    expect(judgeEnding(shaped({ fans: 5_000_000, core: 80, bond: 50 }))).toBe("world_star");
  });

  it("national_idol: 팬 200만 + 예능감 65 + 평판 70", () => {
    const state = shaped({ fans: 2_000_000, core: 60, variety: 65, reputation: 70, bond: 50 });
    expect(judgeEnding(state)).toBe("national_idol");
  });

  it("top_idol: 팬 100만 (actor 조건을 겸해도 top_idol 이 먼저)", () => {
    const state = shaped({ fans: 1_000_000, acting: 95, bond: 50, reputation: 50 });
    expect(judgeEnding(state)).toBe("top_idol");
  });

  it("actor: 연기 80 + 팬 10만", () => {
    expect(judgeEnding(shaped({ fans: 100_000, acting: 80 }))).toBe("actor");
  });

  it("variety_star: 예능감 85", () => {
    expect(judgeEnding(shaped({ fans: 50_000, variety: 85 }))).toBe("variety_star");
  });

  it("solo_vocalist: 보컬 90", () => {
    expect(judgeEnding(shaped({ fans: 50_000, vocal: 90 }))).toBe("solo_vocalist");
  });

  it("performance_king: 댄스 90 (보컬 90 미만)", () => {
    expect(judgeEnding(shaped({ fans: 50_000, dance: 90, vocal: 80 }))).toBe("performance_king");
  });

  it("hiphop_artist: 랩 85", () => {
    expect(judgeEnding(shaped({ fans: 50_000, rap: 85 }))).toBe("hiphop_artist");
  });

  it("longrun_idol: 데뷔 + 팬 10만", () => {
    expect(judgeEnding(shaped({ fans: 120_000 }))).toBe("longrun_idol");
  });

  it("indie_musician: 데뷔했지만 팬 10만 미만", () => {
    expect(judgeEnding(shaped({ fans: 20_000 }))).toBe("indie_musician");
  });

  it("indie_musician: 미데뷔 + 보컬 60 이상", () => {
    expect(judgeEnding(shaped({ debuted: false, vocal: 60, fans: 800 }))).toBe("indie_musician");
  });

  it("ordinary_life: 그 외 전부", () => {
    expect(judgeEnding(shaped({ debuted: false, core: 20, fans: 300 }))).toBe("ordinary_life");
  });

  it("조기 엔딩 3종의 condition 은 항상 false", () => {
    const rich = shaped({ bond: 100, fans: 9_000_000, core: 95 });
    for (const id of ["contract_terminated", "burnout_leave", "scandal_fall"] as EndingId[]) {
      const def = E.getEndingDef(id);
      expect(def.condition(rich)).toBe(false);
    }
  });
});

describe("엔딩 정의", () => {
  it("15종 모두 제목·요약·힌트·에필로그를 가진다", () => {
    for (const id of ENDING_IDS) {
      const def = E.getEndingDef(id);
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.summary.length).toBeGreaterThan(0);
      expect(def.hint.length).toBeGreaterThan(0);
      expect(def.text.split("\n").length).toBeGreaterThanOrEqual(3);
      expect(def.text.split("\n").length).toBeLessThanOrEqual(5);
    }
  });

  it("에필로그에 {name} 치환자가 들어 있다", () => {
    for (const def of ENDINGS) {
      expect(def.text, `${def.id}`).toContain("{name}");
    }
  });

  it("등급이 GDD 표와 같다", () => {
    const grades = Object.fromEntries(ENDINGS.map((e) => [e.id, e.grade]));
    expect(grades.contract_terminated).toBe("D");
    expect(grades.burnout_leave).toBe("D");
    expect(grades.scandal_fall).toBe("D");
    expect(grades.partner_secret).toBe("S");
    expect(grades.world_star).toBe("S");
    expect(grades.national_idol).toBe("S");
    expect(grades.top_idol).toBe("A");
    expect(grades.longrun_idol).toBe("B");
    expect(grades.indie_musician).toBe("B");
    expect(grades.ordinary_life).toBe("C");
  });
});
