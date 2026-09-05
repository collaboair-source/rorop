"use client";

/**
 * 히어로 — 장면 배경 + 하람 상반신 + 버블 슬롯 (04 문서 3.3).
 * 화면의 절반을 아이돌에게 준다. 이미지가 없으면 배경은 장면 모티프, 초상은 실루엣.
 */

import type { ReactNode } from "react";
import { portraitSrc } from "@/game/idol/assets";
import type { BackgroundImageId, Emotion, PortraitStage } from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { SceneBg } from "./SceneBg";
import { Silhouette } from "./Silhouette";
import { Bubble } from "./Bubble";

export function HeroAvatar({
  stage,
  emotion,
  name,
}: {
  stage: PortraitStage;
  emotion: Emotion;
  name: string;
}) {
  return (
    <GameImage
      src={portraitSrc(stage, emotion)}
      alt={name}
      className="h-full w-full"
      objectPosition="top"
      fallback={<Silhouette stage={stage} emotion={emotion} size="full" badge={false} />}
    />
  );
}

export function HeroScene({
  bg,
  stage,
  emotion,
  name,
  line,
  time,
  height = 360,
  scrim = true,
  align = "center",
  children,
  className = "",
}: {
  bg: BackgroundImageId;
  stage: PortraitStage;
  emotion: Emotion;
  name: string;
  line?: string;
  time?: string;
  height?: number;
  scrim?: boolean;
  align?: "center" | "right";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height }}
      data-testid="hero-scene"
    >
      <SceneBg id={bg} scrim={scrim} />

      {/* 초상 — 하단 정렬, 폭 최대 300px */}
      <div
        className={[
          "absolute bottom-0 h-full w-full max-w-[300px]",
          align === "right" ? "right-0" : "left-1/2 -translate-x-1/2",
        ].join(" ")}
      >
        <HeroAvatar stage={stage} emotion={emotion} name={name} />
      </div>

      {line ? (
        <div className="absolute inset-x-3 bottom-8 max-w-[80%]">
          <Bubble
            name={name}
            time={time}
            text={line}
            avatar={
              <span className="block h-full w-full scale-[1.6] origin-top">
                <Silhouette stage={stage} emotion={emotion} size="full" badge={false} />
              </span>
            }
          />
        </div>
      ) : null}

      {children}
    </div>
  );
}
