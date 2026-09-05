"use client";

/**
 * 포트레이트 폴백 — 상반신 실루엣 SVG (04 문서 2.3).
 * 이니셜 상자를 쓰지 않는다. 머리·목·어깨의 단순한 곡선과 앞머리 한 가닥,
 * 뒤에 스포트라이트 원뿔, 오른쪽 아래에 감정 아이콘 배지.
 * 색은 단계별 토큰(--sil-body / --sil-hair / --sil-glow)으로만 정한다.
 */

import { useId } from "react";
import { EMOTION_ICONS, EMOTION_LABELS } from "@/game/idol/assets";
import type { Emotion, PortraitStage } from "@/game/idol/types";

const STAGE_CLASS: Record<PortraitStage, string> = {
  trainee: "sil-trainee",
  rookie: "sil-rookie",
  star: "sil-star",
};

const STAGE_LABELS: Record<PortraitStage, string> = {
  trainee: "연습생",
  rookie: "신인",
  star: "스타",
};

const SIZE_CLASS = {
  sm: "h-16 w-16",
  md: "h-32 w-28",
  lg: "h-64 w-56",
  full: "h-full w-full",
} as const;

const BADGE_CLASS = {
  sm: "hidden",
  md: "h-6 w-6 text-[13px]",
  lg: "h-9 w-9 text-[19px]",
  full: "h-8 w-8 text-[17px]",
} as const;

export function Silhouette({
  stage,
  emotion,
  size = "full",
  badge = true,
  className = "",
}: {
  stage: PortraitStage;
  emotion: Emotion;
  size?: keyof typeof SIZE_CLASS;
  badge?: boolean;
  className?: string;
}) {
  const gradId = `sil${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div
      className={`relative ${SIZE_CLASS[size]} ${STAGE_CLASS[stage]} ${className}`}
      role="img"
      aria-label={`${STAGE_LABELS[stage]} 실루엣 (${EMOTION_LABELS[emotion]})`}
    >
      <svg
        viewBox="0 0 120 160"
        preserveAspectRatio="xMidYMax meet"
        className="h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradId} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="var(--sil-glow)" stopOpacity="0.55" />
            <stop offset="55%" stopColor="var(--sil-glow)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--sil-glow)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradId}-fade`} x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="35%" stopColor="#000" stopOpacity="1" />
            <stop offset="65%" stopColor="#000" stopOpacity="1" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <mask id={`${gradId}-mask`}>
            <rect x="0" y="0" width="120" height="160" fill={`url(#${gradId}-fade)`} />
          </mask>
        </defs>

        {/* 스포트라이트 원뿔 */}
        <path
          d="M60 -6 L112 160 L8 160 Z"
          fill={`url(#${gradId})`}
          mask={`url(#${gradId}-mask)`}
        />

        {/* 어깨 — 곡선 두 개 */}
        <path
          d="M60 92c-22 0-38 12-45 30-4 10-6 22-6 38h102c0-16-2-28-6-38-7-18-23-30-45-30z"
          fill="var(--sil-body)"
        />
        {/* 목 */}
        <path d="M50 74h20v22c0 5-20 5-20 0z" fill="var(--sil-body)" />
        {/* 머리 */}
        <ellipse cx="60" cy="52" rx="24" ry="28" fill="var(--sil-body)" />
        {/* 머리카락 (윗머리) */}
        <path
          d="M60 20c-16 0-26 11-26 26 0 4 .6 8 1.6 11 1.4-9 3-15 6-19 7 4 22 5 34 1 4 3 6 9 6.6 18 1.2-3 1.8-7 1.8-11 0-15-10-26-24-26z"
          fill="var(--sil-hair)"
        />
        {/* 앞머리 한 가닥 */}
        <path
          d="M56 26c-5 6-8 15-6 26 1.6-9 4.6-17 9-23z"
          fill="var(--sil-hair)"
        />
      </svg>

      {badge && size !== "sm" ? (
        <span
          className={`absolute bottom-1 right-1 flex ${BADGE_CLASS[size]} items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] leading-none shadow-[var(--shadow)]`}
          aria-hidden="true"
        >
          {EMOTION_ICONS[emotion]}
        </span>
      ) : null}
    </div>
  );
}
