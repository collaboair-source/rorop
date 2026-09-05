"use client";

/**
 * 장면 배경 — 이미지가 있으면 전면으로, 없으면 04 문서 2.3 의 장면별 모티프(CSS)로 채운다.
 * 모티프 색은 전부 idol.css 의 .scene-* 클래스에 있다 (컴포넌트는 클래스 이름만 고른다).
 */

import { bgSrc } from "@/game/idol/assets";
import type { BackgroundImageId } from "@/game/idol/types";
import { GameImage } from "./GameImage";

const MOTIF: Partial<Record<BackgroundImageId, string>> = {
  practice_room: "scene-mirror",
  dorm: "scene-window",
  stage_music_show: "scene-beam",
  concert_arena: "scene-beam",
  award_stage: "scene-beam",
  office: "scene-warm",
  cafe: "scene-warm",
  convenience_store: "scene-warm",
  hospital: "scene-warm",
  fansign: "scene-warm",
  recording_studio: "scene-cool",
  photo_studio: "scene-cool",
  variety_studio: "scene-cool",
  airport: "scene-cool",
  park_busking: "scene-cool",
};

/** 무대 계열 배경이면 온스테이지 토큰(.stage)을 쓴다 */
export function isStageBg(id: BackgroundImageId | null | undefined): boolean {
  return id === "stage_music_show" || id === "award_stage" || id === "concert_arena";
}

export function sceneMotifClass(id: BackgroundImageId): string {
  return MOTIF[id] ?? "scene-default";
}

export function SceneBg({
  id,
  className = "",
  scrim = false,
}: {
  id: BackgroundImageId;
  className?: string;
  scrim?: boolean;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <GameImage
        src={bgSrc(id)}
        alt=""
        className="absolute inset-0 h-full w-full"
        fallback={<div className={`scene ${sceneMotifClass(id)}`} />}
      />
      {scrim ? <div className="scene-scrim" /> : null}
    </div>
  );
}
