"use client";

/**
 * 포토카드 — 3:4, 반지름 14px, 2px 프레임(단계별), 하단 라벨 띠 (04 문서 1.4 / 2.2).
 * 잠긴 카드는 홀로 뒷면 + 별 워드마크 + 힌트 한 줄이고, 이미지를 요청하지 않는다(404 방지).
 */

import type { ReactNode } from "react";
import { EMOTION_LABELS } from "@/game/idol/assets";
import type { Emotion, PortraitStage } from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { Silhouette } from "./Silhouette";
import { Icon } from "./ui";
import type { CardDef, CardFrame } from "./album";

const FRAME_CLASS: Record<CardFrame, string> = {
  basic: "pc-basic",
  silver: "pc-silver",
  gold: "pc-gold",
  holo: "pc-holo",
};

const SIZE_WIDTH = {
  sm: "w-[54px]",
  md: "w-[92px]",
  lg: "w-full",
} as const;

const LABEL_TEXT = {
  sm: "text-[9px]",
  md: "text-[11px]",
  lg: "text-[12px]",
} as const;

export type PhotocardSize = keyof typeof SIZE_WIDTH;

export function Photocard({
  src,
  frame = "basic",
  label,
  sublabel,
  locked = false,
  hint,
  size = "md",
  onClick,
  fallback,
  overlay,
  className = "",
  testId,
  ariaLabel,
}: {
  src?: string;
  frame?: CardFrame;
  label?: string;
  sublabel?: string;
  locked?: boolean;
  hint?: string;
  size?: PhotocardSize;
  onClick?: () => void;
  fallback?: ReactNode;
  overlay?: ReactNode;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}) {
  const body = (
    <span className={`pc ${FRAME_CLASS[frame]} block`}>
      {locked ? (
        <span className="absolute inset-0 block">
          <span className="pc-back absolute inset-0 block" />
          <span className="pc-back-veil absolute inset-0 flex flex-col items-center justify-center gap-1 px-1.5 text-center">
            <Icon name="star" size={size === "sm" ? 14 : 20} className="on-media-2" />
            {hint && size !== "sm" ? (
              <span className="on-media-2 line-clamp-3 text-[10px] leading-4">{hint}</span>
            ) : null}
          </span>
        </span>
      ) : (
        <>
          {src ? (
            <GameImage
              src={src}
              alt={label ?? ""}
              className="absolute inset-0 h-full w-full"
              objectPosition="top"
              fallback={
                <span className="absolute inset-0 flex items-end justify-center bg-[var(--surface-2)]">
                  {fallback ?? null}
                </span>
              }
            />
          ) : (
            <span className="absolute inset-0 flex items-end justify-center bg-[var(--surface-2)]">
              {fallback ?? null}
            </span>
          )}
          {overlay}
        </>
      )}

      {label && !locked ? (
        <span className="absolute inset-x-0 bottom-0 block bg-[var(--scrim)] px-1.5 py-1 backdrop-blur-[2px]">
          <span className={`on-media block truncate font-bold ${LABEL_TEXT[size]}`}>{label}</span>
          {sublabel && size !== "sm" ? (
            <span className="on-media-2 block truncate text-[10px] leading-3">{sublabel}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  const shell = `${SIZE_WIDTH[size]} shrink-0 ${className}`;

  if (!onClick) {
    return (
      <span className={`${shell} block`} data-testid={testId} aria-label={ariaLabel}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel ?? label ?? "포토카드"}
      className={`${shell} block cursor-pointer text-left transition-transform duration-[120ms] active:scale-[0.98]`}
    >
      {body}
    </button>
  );
}

/** 카드 종류별 이미지 폴백 (초상은 실루엣, 나머지는 장면 모티프) */
export function cardFallback(card: CardDef): ReactNode {
  if (card.set === "trainee" || card.set === "rookie" || card.set === "star") {
    const stage = card.set as PortraitStage;
    const emotion = card.id.split("_").slice(1).join("_") as Emotion;
    return <Silhouette stage={stage} emotion={emotion} size="full" badge={false} />;
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className={`scene ${card.set === "ending" ? "scene-beam" : "scene-default"}`} />
      <Icon name="star" size={22} className="relative text-[var(--accent-ink)]" />
    </span>
  );
}

/** 초상 포토카드 (타이틀 이어하기·저장 슬롯·리포트에서 쓰는 작은 카드) */
export function PortraitCard({
  stage,
  emotion,
  src,
  label,
  sublabel,
  size = "sm",
  frame = "basic",
  className = "",
}: {
  stage: PortraitStage;
  emotion: Emotion;
  src: string;
  label?: string;
  sublabel?: string;
  size?: PhotocardSize;
  frame?: CardFrame;
  className?: string;
}) {
  return (
    <Photocard
      src={src}
      frame={frame}
      label={label}
      sublabel={sublabel}
      size={size}
      className={className}
      ariaLabel={`${label ?? ""} ${EMOTION_LABELS[emotion]}`}
      fallback={<Silhouette stage={stage} emotion={emotion} size="full" badge={size !== "sm"} />}
    />
  );
}
