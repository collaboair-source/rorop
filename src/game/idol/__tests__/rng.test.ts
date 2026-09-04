import { describe, expect, it } from "vitest";

import { nextRandom, randInt, randPick, randRange, seedFromString } from "../rng";

function sequence(seed: number, count: number): number[] {
  let state = seed;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = nextRandom(state);
    out.push(r.value);
    state = r.next;
  }
  return out;
}

describe("rng", () => {
  it("같은 시드는 같은 수열을 만든다", () => {
    expect(sequence(42, 20)).toEqual(sequence(42, 20));
  });

  it("다른 시드는 다른 수열을 만든다", () => {
    expect(sequence(42, 20)).not.toEqual(sequence(43, 20));
  });

  it("value 는 [0, 1) 범위다", () => {
    for (const value of sequence(7, 500)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("randRange 는 [min, max) 범위다", () => {
    let state = 99;
    for (let i = 0; i < 200; i += 1) {
      const r = randRange(state, 0.85, 1.15);
      expect(r.value).toBeGreaterThanOrEqual(0.85);
      expect(r.value).toBeLessThan(1.15);
      state = r.next;
    }
  });

  it("randInt 는 [min, max] 정수를 만든다", () => {
    let state = 5;
    const seen = new Set<number>();
    for (let i = 0; i < 300; i += 1) {
      const r = randInt(state, 5, 15);
      expect(Number.isInteger(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(5);
      expect(r.value).toBeLessThanOrEqual(15);
      seen.add(r.value);
      state = r.next;
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("randPick 은 빈 배열에서 null 을 돌려준다", () => {
    expect(randPick(1, []).value).toBeNull();
    expect(randPick(1, ["a", "b"]).value).not.toBeNull();
  });

  it("seedFromString 은 결정적이다", () => {
    expect(seedFromString("하람")).toBe(seedFromString("하람"));
    expect(seedFromString("하람")).not.toBe(seedFromString("하늘"));
  });
});
