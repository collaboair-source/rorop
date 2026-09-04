"use client";

/** 포트레이트 — /idol/char/{stage}_{emotion}.png, 폴백은 그라데이션 + 이니셜 + 감정 아이콘 */

import {
  EMOTION_ICONS,
  EMOTION_LABELS,
  PORTRAIT_FALLBACK_GRADIENT,
  nameInitial,
  portraitSrc,
} from "@/game/idol/assets";
import type { Emotion, PortraitStage } from "@/game/idol/types";
import { GameImage } from "./GameImage";

const STAGE_LABELS: Record<PortraitStage, string> = {
  trainee: "연습생",
  rookie: "신인",
  star: "스타",
};

export function Portrait({
  stage,
  emotion,
  name,
  size = "md",
  className = "",
}: {
  stage: PortraitStage;
  emotion: Emotion;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "sm" ? "h-[92px] w-[76px]" : size === "lg" ? "h-[240px] w-[190px]" : "h-[150px] w-[124px]";
  const initialSize = size === "sm" ? "text-[26px]" : size === "lg" ? "text-[64px]" : "text-[40px]";

  return (
    <GameImage
      src={portraitSrc(stage, emotion)}
      alt={`${name} (${STAGE_LABELS[stage]}, ${EMOTION_LABELS[emotion]})`}
      className={`${box} shrink-0 rounded-2xl border border-[#2C3766] ${className}`}
      fallback={
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1"
          style={{ background: PORTRAIT_FALLBACK_GRADIENT[stage] }}
        >
          <span className={`${initialSize} font-black leading-none text-[#EEF0FF]/85`}>
            {nameInitial(name)}
          </span>
          <span className={size === "sm" ? "text-[16px]" : "text-[22px]"} aria-hidden="true">
            {EMOTION_ICONS[emotion]}
          </span>
          {size !== "sm" ? (
            <span className="text-[10px] tracking-wide text-[#98A2CC]">{STAGE_LABELS[stage]}</span>
          ) : null}
        </div>
      }
    />
  );
}
