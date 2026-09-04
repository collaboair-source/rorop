"use client";

/** 상단바 — 년차/월, 페이즈 배지, 자금, 팬 (+ 저장·메뉴) */

import { formatFans } from "@/game/idol/engine";
import { PHASE_BADGE_COLORS } from "@/game/idol/assets";
import { CAREER_PHASE_LABELS, TOTAL_MONTHS } from "@/game/idol/types";
import type { GameState } from "@/game/idol/types";
import { Button } from "./ui";

export function monthLabel(month: number): string {
  const year = Math.floor((month - 1) / 12) + 1;
  const inYear = ((month - 1) % 12) + 1;
  return `${year}년차 ${inYear}월`;
}

export function TopBar({ state, onOpenMenu }: { state: GameState; onOpenMenu?: () => void }) {
  const phase = state.career.phase;
  return (
    <header className="sticky top-0 z-20 border-b border-[#242E52] bg-[#0B1020]/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-bold" data-testid="month-label">
              {monthLabel(state.month)}
            </span>
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                color: PHASE_BADGE_COLORS[phase],
                border: `1px solid ${PHASE_BADGE_COLORS[phase]}66`,
                backgroundColor: `${PHASE_BADGE_COLORS[phase]}1A`,
              }}
            >
              {CAREER_PHASE_LABELS[phase]}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[#C7CCEB]">
            <span className="tabular-nums">
              <span aria-hidden="true">💰</span> {state.economy.money.toLocaleString("ko-KR")}만
            </span>
            <span className="tabular-nums" data-testid="fans">
              <span aria-hidden="true">👥</span> {formatFans(state.idol.social.fans)}
            </span>
            <span className="text-[#98A2CC]">
              {state.month}/{TOTAL_MONTHS}
            </span>
          </div>
        </div>
        {onOpenMenu ? (
          <Button small variant="secondary" onClick={onOpenMenu} testId="open-menu">
            메뉴
          </Button>
        ) : null}
      </div>
    </header>
  );
}
