"use client";

/** 팬 앱 DM 스타일 말풍선 (04 문서 3.3). 아바타 + 이름 + 시각 + 흰 말풍선(꼬리 왼쪽). */

import type { ReactNode } from "react";

export function Bubble({
  name,
  time,
  text,
  avatar,
  className = "",
}: {
  name: string;
  time?: string;
  text: string;
  avatar?: ReactNode;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div className={`flex max-w-full items-start gap-2 ${className}`}>
      {avatar ? (
        <span className="mt-0.5 block h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--line)] bg-[var(--surface-2)]">
          {avatar}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] leading-none">
          <span className="font-bold text-[var(--ink)]">{name}</span>
          {time ? <span className="text-[var(--ink-3)]">{time}</span> : null}
        </p>
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-3 block h-2.5 w-2.5 rotate-45 border-b border-l border-[var(--line)] bg-[var(--surface)]"
          />
          <p className="relative rounded-[14px] rounded-tl-[4px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-6 text-[var(--ink)] shadow-[var(--shadow)]">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
