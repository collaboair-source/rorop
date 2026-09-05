/**
 * 포토카드 41장 카탈로그와 획득 규칙 (04 문서 2.2).
 * 엔진은 건드리지 않는다 — 획득 여부는 save.ts 의 `idolboy.album` 에만 쌓인다.
 */

import { getEndingDef } from "@/game/idol/engine";
import { cgSrc, endingSrc, portraitSrc, EMOTION_LABELS } from "@/game/idol/assets";
import {
  CG_IDS,
  ENDING_IDS,
  type CgId,
  type Emotion,
  type EndingId,
  type GameEventDef,
  type GameState,
  type PortraitStage,
} from "@/game/idol/types";

export type CardSet = "trainee" | "rookie" | "star" | "cg" | "ending";
export type CardFrame = "basic" | "silver" | "gold" | "holo";

export interface CardDef {
  id: string;
  set: CardSet;
  label: string;
  sublabel: string;
  hint: string;
  frame: CardFrame;
  /** 잠겨 있을 때는 요청하지 않는다 (404 방지) */
  src: string;
}

export const CARD_SETS: CardSet[] = ["trainee", "rookie", "star", "cg", "ending"];

export const CARD_SET_LABELS: Record<CardSet, string> = {
  trainee: "연습생",
  rookie: "신인",
  star: "스타",
  cg: "순간",
  ending: "엔딩",
};

const EMOTIONS: Emotion[] = ["neutral", "happy", "tired", "sad", "excited", "determined"];

const PORTRAIT_SETS: Array<{ set: CardSet; stage: PortraitStage; frame: CardFrame; hint: string }> = [
  { set: "trainee", stage: "trainee", frame: "basic", hint: "데뷔 전, 이 표정을 처음 보게 되면." },
  { set: "rookie", stage: "rookie", frame: "silver", hint: "데뷔 직후 신인 시절의 표정." },
  { set: "star", stage: "star", frame: "gold", hint: "라이징 스타가 된 뒤의 표정." },
];

const CG_LABELS: Record<CgId, string> = {
  debut_showcase: "데뷔 쇼케이스",
  first_win: "첫 1위",
  award_grand_prize: "대상 수상",
  scandal_news: "스캔들 보도",
  burnout_night: "한계의 밤",
  world_tour: "월드투어",
  bond_promise: "진심",
  comeback_stage: "컴백 무대",
};

const CG_HINTS: Record<CgId, string> = {
  debut_showcase: "데뷔 평가를 통과하는 날.",
  first_win: "음악방송에서 처음 1위를 하면.",
  award_grand_prize: "연말 시상식에서 대상을 받으면.",
  scandal_news: "루머나 열애설이 기사로 나가는 날.",
  burnout_night: "스트레스가 끝까지 차오른 밤.",
  world_tour: "세계를 도는 공연이 성사되면.",
  bond_promise: "서로에게 약속을 건네는 순간.",
  comeback_stage: "첫 컴백 결과를 확인하면.",
};

function buildCards(): CardDef[] {
  const out: CardDef[] = [];
  for (const group of PORTRAIT_SETS) {
    for (const emotion of EMOTIONS) {
      out.push({
        id: `char:${group.stage}_${emotion}`,
        set: group.set,
        label: EMOTION_LABELS[emotion],
        sublabel: CARD_SET_LABELS[group.set],
        hint: group.hint,
        frame: group.frame,
        src: portraitSrc(group.stage, emotion),
      });
    }
  }
  for (const id of CG_IDS) {
    out.push({
      id: `cg:${id}`,
      set: "cg",
      label: CG_LABELS[id],
      sublabel: "순간",
      hint: CG_HINTS[id],
      frame: "holo",
      src: cgSrc(id),
    });
  }
  for (const id of ENDING_IDS) {
    const def = getEndingDef(id);
    out.push({
      id: `ending:${id}`,
      set: "ending",
      label: def.title,
      sublabel: `등급 ${def.grade}`,
      hint: def.hint,
      frame: "holo",
      src: endingSrc(id),
    });
  }
  return out;
}

export const CARDS: CardDef[] = buildCards();
export const CARD_TOTAL = CARDS.length;

const BY_ID = new Map<string, CardDef>(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): CardDef | null {
  return BY_ID.get(id) ?? null;
}

export function cardsOfSet(set: CardSet): CardDef[] {
  return CARDS.filter((c) => c.set === set);
}

export function portraitCardId(stage: PortraitStage, emotion: Emotion): string {
  return `char:${stage}_${emotion}`;
}

export function endingCardId(id: EndingId): string {
  return `ending:${id}`;
}

/**
 * 지금 상태에서 "이미 마주친" 카드 id 목록.
 * unlockCards 가 새로 열린 것만 돌려주므로 매번 통째로 넘겨도 안전하다.
 */
export function collectUnlocks(
  state: GameState,
  options?: { stage?: PortraitStage; emotion?: Emotion; event?: GameEventDef | null },
): string[] {
  const ids: string[] = [];

  if (options?.stage && options.emotion) {
    ids.push(portraitCardId(options.stage, options.emotion));
  }

  // flags.cg_* 로 확정되는 순간들
  for (const id of CG_IDS) {
    if (state.flags[`cg_${id}`]) ids.push(`cg:${id}`);
  }
  // 이벤트 CG (루머·열애설 = scandal_news, E31 = burnout_night 등)
  if (options?.event?.cg) ids.push(`cg:${options.event.cg}`);
  // 첫 컴백 결과 화면
  if (state.ui.lastComeback) ids.push("cg:comeback_stage");
  // 엔딩
  if (state.ending) ids.push(endingCardId(state.ending.id));

  return ids;
}
