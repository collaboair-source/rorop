/**
 * 시드 기반 난수 (mulberry32)
 *
 * 엔진은 Math.random 을 절대 쓰지 않는다. 모든 난수는 GameState.rngState 에서 꺼내
 * 갱신된 상태를 다시 넣는 방식으로만 소비한다 → 같은 시드·같은 입력이면 항상 같은 결과.
 */

export interface RngResult {
  value: number;
  next: number;
}

/** mulberry32. value ∈ [0, 1) */
export function nextRandom(state: number): RngResult {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next };
}

/** min 이상 max 미만의 실수 */
export function randRange(state: number, min: number, max: number): RngResult {
  const r = nextRandom(state);
  return { value: min + r.value * (max - min), next: r.next };
}

/** min 이상 max 이하의 정수 */
export function randInt(state: number, min: number, max: number): RngResult {
  const r = nextRandom(state);
  return { value: min + Math.floor(r.value * (max - min + 1)), next: r.next };
}

/** 배열에서 하나 고르기 (빈 배열이면 null) */
export function randPick<T>(state: number, items: readonly T[]): { value: T | null; next: number } {
  if (items.length === 0) return { value: null, next: state };
  const r = randInt(state, 0, items.length - 1);
  return { value: items[r.value] ?? null, next: r.next };
}

/** 문자열 → 32bit 시드 (사용자 입력 시드용) */
export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
