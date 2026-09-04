/** 출신 5종 — GDD 2.3, 2.5 표 그대로 */

import type { BackgroundDef, BackgroundId } from "../types";

const RAW = [
  {
    id: "street_cast",
    label: "길거리 캐스팅",
    description:
      "홍대 골목에서 명함을 받았다. 노래도 춤도 배운 적 없지만, 지나가던 사람들이 한 번씩 돌아보는 얼굴을 가졌다.",
    skills: { vocal: 15, dance: 15, rap: 10, visual: 55, variety: 20, acting: 15 },
    talents: { vocal: 1.0, dance: 1.0, rap: 1.0, visual: 1.4, variety: 1.0, acting: 1.0 },
    conceptAffinity: { fresh: 1.15, sexy: 1.05, hiphop: 0.9, ballad: 0.95, performance: 0.95 },
    startFans: 2000,
    startMoney: 300,
    startStress: 10,
    startBond: 20,
    startReputation: 50,
    maxStamina: 100,
  },
  {
    id: "dance_academy",
    label: "댄스 학원 에이스",
    description:
      "중학교 때부터 학원 연습실에서 살았다. 몸이 먼저 기억하는 타입이라 안무는 빠르지만, 노래는 아직 낯설다.",
    skills: { vocal: 20, dance: 55, rap: 15, visual: 30, variety: 20, acting: 10 },
    talents: { vocal: 0.9, dance: 1.4, rap: 1.0, visual: 1.0, variety: 1.0, acting: 1.0 },
    conceptAffinity: { fresh: 1.0, sexy: 1.0, hiphop: 1.0, ballad: 0.85, performance: 1.15 },
    startFans: 500,
    startMoney: 300,
    startStress: 10,
    startBond: 20,
    startReputation: 50,
    maxStamina: 110,
  },
  {
    id: "vocal_prodigy",
    label: "보컬 트레이너 추천",
    description:
      "동네 보컬 학원 선생이 회사에 직접 전화를 걸었다. 목소리 하나만큼은 이미 완성형이라는 평가를 받는다.",
    skills: { vocal: 55, dance: 15, rap: 10, visual: 30, variety: 15, acting: 20 },
    talents: { vocal: 1.4, dance: 0.9, rap: 1.0, visual: 1.0, variety: 1.0, acting: 1.0 },
    conceptAffinity: { fresh: 1.05, sexy: 0.9, hiphop: 0.85, ballad: 1.15, performance: 0.95 },
    startFans: 500,
    startMoney: 300,
    startStress: 10,
    startBond: 20,
    startReputation: 50,
    maxStamina: 100,
  },
  {
    id: "underground_rapper",
    label: "언더 래퍼 출신",
    description:
      "고등학교 때부터 클럽 무대에 섰다. 이미 자기 이름을 아는 사람들이 조금 있지만, 회사 시스템은 처음이라 날이 서 있다.",
    skills: { vocal: 20, dance: 20, rap: 55, visual: 25, variety: 25, acting: 10 },
    talents: { vocal: 1.0, dance: 1.0, rap: 1.4, visual: 1.0, variety: 1.0, acting: 0.8 },
    conceptAffinity: { fresh: 0.85, sexy: 1.0, hiphop: 1.15, ballad: 0.9, performance: 1.05 },
    startFans: 1500,
    startMoney: 250,
    startStress: 30,
    startBond: 20,
    startReputation: 40,
    maxStamina: 100,
  },
  {
    id: "child_actor",
    label: "아역 배우 출신",
    description:
      "일곱 살에 데뷔해 열다섯에 잊혔다. 카메라 앞이 편하고 말이 빠르지만, 노래와 춤은 다시 시작하는 셈이다.",
    skills: { vocal: 15, dance: 10, rap: 5, visual: 35, variety: 40, acting: 50 },
    talents: { vocal: 1.0, dance: 1.0, rap: 0.8, visual: 1.0, variety: 1.2, acting: 1.4 },
    conceptAffinity: { fresh: 1.1, sexy: 0.95, hiphop: 0.85, ballad: 1.05, performance: 0.95 },
    startFans: 10000,
    startMoney: 500,
    startStress: 10,
    startBond: 20,
    startReputation: 50,
    maxStamina: 100,
  },
] satisfies BackgroundDef[];

export const BACKGROUNDS: BackgroundDef[] = RAW;

const BY_ID = new Map<BackgroundId, BackgroundDef>(BACKGROUNDS.map((b) => [b.id, b]));

export function getBackground(id: BackgroundId): BackgroundDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 출신: ${id}`);
  return found;
}
