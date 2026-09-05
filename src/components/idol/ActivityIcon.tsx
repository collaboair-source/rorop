"use client";

/** 활동 아이콘 — 이모지를 분류별 연한 배경의 원 안에 넣어 통일한다 (04 문서 1.4). */

import type { ActivityCategory } from "@/game/idol/types";

const CATEGORY_CLASS: Record<ActivityCategory, string> = {
  training: "actico-training",
  work: "actico-work",
  promo: "actico-promo",
  rest: "actico-rest",
};

export function ActivityIcon({
  icon,
  category,
  size = 40,
}: {
  icon: string;
  category: ActivityCategory;
  size?: number;
}) {
  return (
    <span
      className={`actico ${CATEGORY_CLASS[category]} shrink-0`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
