/** 성격 4종 — GDD 2.4 표 그대로 */

import type { PersonalityDef, PersonalityId } from "../types";

const RAW = [
  {
    id: "diligent",
    label: "성실형",
    description: "정해진 시간에 나와 정해진 만큼을 채운다. 대신 쉬는 법을 잘 모른다.",
    trainingMul: 1.1,
    stressMul: 1.0,
    restMul: 0.9,
    fansMul: 1.0,
    bondMul: 1.0,
    scandalMul: 0.8,
    conceptBonus: { performance: 0.05 },
  },
  {
    id: "free_spirit",
    label: "자유분방형",
    description: "재미없으면 손을 놓는다. 대신 카메라가 꺼진 순간에도 자기 이야기를 만든다.",
    trainingMul: 0.9,
    stressMul: 0.8,
    restMul: 1.0,
    fansMul: 1.05,
    bondMul: 1.0,
    scandalMul: 1.5,
    conceptBonus: { hiphop: 0.05, sexy: 0.05 },
  },
  {
    id: "perfectionist",
    label: "완벽주의형",
    description: "될 때까지 붙잡는다. 결과는 빠르게 나오지만 그만큼 자신을 갉아먹는다.",
    trainingMul: 1.2,
    stressMul: 1.3,
    restMul: 1.0,
    fansMul: 1.0,
    bondMul: 0.9,
    scandalMul: 0.8,
    conceptBonus: { ballad: 0.05 },
  },
  {
    id: "optimist",
    label: "낙천형",
    description: "안 되는 날에도 웃는다. 성장은 느긋하지만 사람이 붙는다.",
    trainingMul: 0.95,
    stressMul: 0.9,
    restMul: 1.1,
    fansMul: 1.1,
    bondMul: 1.2,
    scandalMul: 1.0,
    conceptBonus: { fresh: 0.05 },
  },
] satisfies PersonalityDef[];

export const PERSONALITIES: PersonalityDef[] = RAW;

const BY_ID = new Map<PersonalityId, PersonalityDef>(PERSONALITIES.map((p) => [p.id, p]));

export function getPersonality(id: PersonalityId): PersonalityDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 성격: ${id}`);
  return found;
}
