"use client";

/**
 * 주차 해결 연출 — 로그를 한 줄씩 보여준다.
 * 타이머(공개 속도)는 play/page.tsx 가 소유하고 이 컴포넌트는 visibleCount 만큼만 그린다.
 * (React StrictMode 의 useEffect 이중 실행으로 한 틱에 두 주가 진행되는 것을 막기 위한 설계)
 */

import { WEEKS_PER_MONTH } from "@/game/idol/types";
import type { GameSettings, LogEntry } from "@/game/idol/types";
import { Button } from "./ui";

const KIND_MARK: Record<LogEntry["kind"], string> = {
  activity: "▸",
  event: "!",
  system: "·",
  month: "▪",
};

const KIND_COLOR: Record<LogEntry["kind"], string> = {
  activity: "#C7CCEB",
  event: "#FCD34D",
  system: "#98A2CC",
  month: "#5EEAD4",
};

export function ResolveLog({
  log,
  visibleCount,
  weekIndex,
  speed,
  onToggleSpeed,
  done,
}: {
  log: LogEntry[];
  visibleCount: number;
  weekIndex: number;
  speed: GameSettings["speed"];
  onToggleSpeed: () => void;
  done: boolean;
}) {
  const shown = log.slice(0, visibleCount);
  const currentWeek = Math.min(WEEKS_PER_MONTH, weekIndex + 1);

  return (
    <section className="flex flex-1 flex-col" data-testid="resolve-log">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: WEEKS_PER_MONTH }, (_, i) => {
            const state =
              weekIndex >= WEEKS_PER_MONTH || i < weekIndex ? "done" : i === weekIndex ? "now" : "todo";
            return (
              <span
                key={i}
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                  state === "done"
                    ? "bg-[#5EEAD4] text-[#0B1020]"
                    : state === "now"
                      ? "idol-pulse bg-[#A78BFA] text-[#160E2E]"
                      : "border border-[#2C3766] text-[#6E78A8]",
                ].join(" ")}
              >
                {i + 1}
              </span>
            );
          })}
          <span className="ml-1 text-[12px] text-[#98A2CC]">
            {weekIndex >= WEEKS_PER_MONTH ? "월말 정산" : `${currentWeek}주차 진행 중`}
          </span>
        </div>
        <Button small variant="ghost" onClick={onToggleSpeed} testId="toggle-speed">
          {speed === "fast" ? "보통 속도" : "빠르게"}
        </Button>
      </div>

      <ol className="flex-1 space-y-1.5">
        {shown.map((entry, index) => (
          <li
            key={`${entry.week}-${index}-${entry.text.slice(0, 12)}`}
            className="idol-fade-up rounded-xl border border-[#242E52] bg-[#141B33] px-3 py-2"
          >
            <div className="flex gap-2">
              <span className="text-[12px] font-bold" style={{ color: KIND_COLOR[entry.kind] }}>
                {KIND_MARK[entry.kind]}
              </span>
              <p className="flex-1 whitespace-pre-line text-[12.5px] leading-6 text-[#EEF0FF]">
                {entry.text}
              </p>
            </div>
          </li>
        ))}
        {!done && shown.length === log.length ? (
          <li className="idol-pulse px-3 py-2 text-[12px] text-[#98A2CC]">…</li>
        ) : null}
      </ol>
    </section>
  );
}
