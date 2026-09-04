/** 컴백 콘셉트 5종 — 라벨/설명 (적성 수치는 출신 데이터에 있음) */

import type { ComebackFocus, ConceptId } from "../types";

export interface ConceptDef {
  id: ConceptId;
  label: string;
  description: string;
  /** 카드에 붙는 한 줄 태그 */
  tagline: string;
}

const RAW = [
  {
    id: "fresh",
    label: "청량",
    description: "여름 교복, 자전거, 바다. 밝은 신스와 넓은 하늘을 쓰는 정석적인 아이돌 콘셉트.",
    tagline: "가장 무난하고 가장 어렵다",
  },
  {
    id: "sexy",
    label: "섹시",
    description: "낮은 조도와 붉은 조명. 시선을 붙잡는 안무와 절제된 표정이 승부처다.",
    tagline: "이미지를 한 번에 바꾼다",
  },
  {
    id: "hiphop",
    label: "힙합",
    description: "묵직한 808과 직설적인 가사. 대중성보다 고정 팬층의 충성도를 노린다.",
    tagline: "마니아를 만든다",
  },
  {
    id: "ballad",
    label: "발라드",
    description: "편곡을 비우고 목소리만 남긴다. 실력이 부족하면 그대로 드러나는 정면 승부.",
    tagline: "목소리로만 남는다",
  },
  {
    id: "performance",
    label: "퍼포먼스",
    description: "군무와 무대 구성으로 승부한다. 음원보다 무대 영상이 먼저 도는 유형.",
    tagline: "무대가 곧 홍보다",
  },
] satisfies ConceptDef[];

export const CONCEPTS: ConceptDef[] = RAW;

const BY_ID = new Map<ConceptId, ConceptDef>(CONCEPTS.map((c) => [c.id, c]));

export function getConcept(id: ConceptId): ConceptDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 콘셉트: ${id}`);
  return found;
}

export const COMEBACK_FOCUS_LABELS: Record<ComebackFocus, string> = {
  vocal: "보컬",
  dance: "댄스",
  rap: "랩",
};
