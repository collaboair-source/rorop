/** 데이터 무결성 — 개수, id 유일성, 타입 union 과의 일치 */

import { describe, expect, it } from "vitest";

import { ACTIVITIES } from "../data/activities";
import { BACKGROUNDS } from "../data/backgrounds";
import { CONCEPTS } from "../data/concepts";
import { DIALOGUE } from "../data/dialogue";
import { ENDINGS } from "../data/endings";
import { EVENTS } from "../data/events";
import { PERSONALITIES } from "../data/personalities";
import {
  ACTIVITY_IDS,
  BACKGROUND_IDS,
  CONCEPT_IDS,
  ENDING_IDS,
  PERSONALITY_IDS,
  type EndingId,
  type Mood,
} from "../types";

const MOODS: Mood[] = ["stressed", "tired", "bonded", "happy", "neutral"];

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) dup.push(id);
    seen.add(id);
  }
  return dup;
}

describe("데이터 개수", () => {
  it("활동 23종", () => {
    expect(ACTIVITIES).toHaveLength(23);
    expect(ACTIVITY_IDS).toHaveLength(23);
  });

  it("이벤트 39종 (E01~E33, E35~E40)", () => {
    expect(EVENTS).toHaveLength(39);
  });

  it("엔딩 15종", () => {
    expect(ENDINGS).toHaveLength(15);
    expect(ENDING_IDS).toHaveLength(15);
  });

  it("출신 5 · 성격 4 · 콘셉트 5", () => {
    expect(BACKGROUNDS).toHaveLength(5);
    expect(PERSONALITIES).toHaveLength(4);
    expect(CONCEPTS).toHaveLength(5);
  });
});

describe("id 유일성과 union 일치", () => {
  it("활동 id 는 유일하고 ACTIVITY_IDS 와 정확히 일치한다", () => {
    const ids = ACTIVITIES.map((a) => a.id);
    expect(duplicates(ids)).toEqual([]);
    expect(new Set(ids)).toEqual(new Set(ACTIVITY_IDS));
    for (const id of ACTIVITY_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("엔딩 id 는 유일하고 ENDING_IDS 순서와 같다", () => {
    const ids = ENDINGS.map((e) => e.id);
    expect(duplicates(ids)).toEqual([]);
    expect(ids).toEqual([...ENDING_IDS]);
  });

  it("출신·성격·콘셉트 id 가 union 과 일치한다", () => {
    expect(BACKGROUNDS.map((b) => b.id)).toEqual([...BACKGROUND_IDS]);
    expect(PERSONALITIES.map((p) => p.id)).toEqual([...PERSONALITY_IDS]);
    expect(CONCEPTS.map((c) => c.id)).toEqual([...CONCEPT_IDS]);
  });

  it("이벤트 id 는 유일하다", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(duplicates(ids)).toEqual([]);
  });

  it("각 이벤트의 선택지 id 는 이벤트 안에서 유일하다", () => {
    for (const event of EVENTS) {
      const ids = event.choices.map((c) => c.id);
      expect(duplicates(ids), `${event.id} 선택지 중복`).toEqual([]);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(3);
    }
  });
});

describe("이벤트 데이터 규약", () => {
  it("모든 선택지가 결과 문구를 가진다", () => {
    for (const event of EVENTS) {
      expect(event.text.length, `${event.id} 본문 없음`).toBeGreaterThan(0);
      for (const choice of event.choices) {
        expect(choice.label.length, `${event.id}/${choice.id} 라벨 없음`).toBeGreaterThan(0);
        expect(choice.resultText.length, `${event.id}/${choice.id} 결과 문구 없음`).toBeGreaterThan(0);
      }
    }
  });

  it("선택지가 가리키는 엔딩 id 는 실제로 존재한다", () => {
    const valid = new Set<string>(ENDING_IDS);
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        if (choice.endingId) expect(valid.has(choice.endingId)).toBe(true);
        const failEnding = choice.check?.failure.endingId;
        if (failEnding) expect(valid.has(failEnding as EndingId)).toBe(true);
      }
    }
  });

  it("강제 이벤트는 stress_break·stamina_collapse 두 개뿐이다", () => {
    const forced = EVENTS.filter((e) => e.trigger.forced).map((e) => e.id);
    expect(forced.sort()).toEqual(["stamina_collapse", "stress_break"]);
  });

  it("월말 이벤트는 money_crisis 하나뿐이다", () => {
    const atEnd = EVENTS.filter((e) => e.trigger.atMonthEnd).map((e) => e.id);
    expect(atEnd).toEqual(["money_crisis"]);
  });

  it("fixed_month 이벤트는 month 를 가진다", () => {
    for (const event of EVENTS) {
      if (event.trigger.kind !== "fixed_month") continue;
      expect(event.trigger.month, `${event.id}`).toBeDefined();
    }
  });

  it("서사 텍스트에 이모지를 쓰지 않는다", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const event of EVENTS) {
      expect(emoji.test(event.text), `${event.id} 본문`).toBe(false);
      for (const choice of event.choices) {
        expect(emoji.test(choice.label + choice.resultText), `${event.id}/${choice.id}`).toBe(false);
      }
    }
    for (const ending of ENDINGS) {
      expect(emoji.test(ending.text), `${ending.id} 에필로그`).toBe(false);
    }
  });
});

describe("대사 풀", () => {
  it("연습생/데뷔 후 × 무드 5종 = 10풀, 각 6~8줄", () => {
    let pools = 0;
    for (const stage of ["trainee", "debuted"] as const) {
      for (const mood of MOODS) {
        const pool = DIALOGUE[stage][mood];
        expect(pool.length, `${stage}/${mood}`).toBeGreaterThanOrEqual(6);
        expect(pool.length, `${stage}/${mood}`).toBeLessThanOrEqual(8);
        expect(new Set(pool).size).toBe(pool.length);
        pools += 1;
      }
    }
    expect(pools).toBe(10);
  });
});

describe("활동 데이터 규약", () => {
  it("아이콘과 설명이 있다", () => {
    for (const activity of ACTIVITIES) {
      expect(activity.icon.length).toBeGreaterThan(0);
      expect(activity.description.length).toBeGreaterThan(0);
      expect(activity.label.length).toBeGreaterThan(0);
    }
  });

  it("팬 공식을 쓰는 활동은 promo/work 분류다", () => {
    for (const activity of ACTIVITIES) {
      if (!activity.fansFormula) continue;
      expect(["promo", "work"]).toContain(activity.category);
    }
  });
});
