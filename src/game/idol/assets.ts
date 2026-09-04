/**
 * 이미지 경로 규약 + 폴백 정보 (docs/idol-game/03_IMAGE_PROMPTS.md).
 * 파일이 없어도 게임은 완전히 동작해야 한다 — 존재 여부를 빌드 시점에 검사하지 않는다.
 */

import type {
  BackgroundImageId,
  CareerPhase,
  CgId,
  Emotion,
  EndingId,
  PortraitStage,
} from "./types";

export const ASSET_ROOT = "/idol";

export function portraitSrc(stage: PortraitStage, emotion: Emotion): string {
  return `${ASSET_ROOT}/char/${stage}_${emotion}.png`;
}

export function bgSrc(id: BackgroundImageId): string {
  return `${ASSET_ROOT}/bg/${id}.png`;
}

export function cgSrc(id: CgId): string {
  return `${ASSET_ROOT}/cg/${id}.png`;
}

export function endingSrc(id: EndingId): string {
  return `${ASSET_ROOT}/ending/${id}.png`;
}

export function titleSrc(): string {
  return `${ASSET_ROOT}/ui/title_key_visual.png`;
}

export function logoSrc(): string {
  return `${ASSET_ROOT}/ui/logo.png`;
}

// ---------------------------------------------------------------------------
// 폴백 정보 (이미지가 없을 때 UI 가 그릴 대체 표현)
// ---------------------------------------------------------------------------

export const EMOTION_LABELS: Record<Emotion, string> = {
  neutral: "평온",
  happy: "기쁨",
  tired: "지침",
  sad: "우울",
  excited: "들뜸",
  determined: "결의",
};

/** 폴백 포트레이트에 얹는 감정 아이콘 (서사 텍스트가 아닌 UI 아이콘) */
export const EMOTION_ICONS: Record<Emotion, string> = {
  neutral: "🙂",
  happy: "😊",
  tired: "😪",
  sad: "😔",
  excited: "🤩",
  determined: "😤",
};

/** 폴백 그라데이션 (CSS linear-gradient 값) */
export const PORTRAIT_FALLBACK_GRADIENT: Record<PortraitStage, string> = {
  trainee: "linear-gradient(160deg, #2A2F55 0%, #141B33 100%)",
  rookie: "linear-gradient(160deg, #3B2F6B 0%, #16203C 100%)",
  star: "linear-gradient(160deg, #5B3F8F 0%, #1B2447 100%)",
};

export const BG_FALLBACK_GRADIENT = "linear-gradient(180deg, #1A2145 0%, #0B1020 100%)";

export const PHASE_BADGE_COLORS: Record<CareerPhase, string> = {
  trainee: "#94A3B8",
  rookie: "#5EEAD4",
  rising: "#A78BFA",
  star: "#FBBF24",
};

/** 아이돌 이름의 첫 글자 (폴백 포트레이트용) */
export function nameInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1) : "?";
}
