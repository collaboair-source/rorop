"use client";

/** 포토카드 획득 토스트 — 카드 썸네일 + 이름, 2.4s (04 문서 2.2). */

import { useEffect } from "react";
import { Photocard, cardFallback } from "./Photocard";
import type { CardDef } from "./album";

export function Toast({ card, onDone }: { card: CardDef; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(id);
  }, [card.id, onDone]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3"
      role="status"
      aria-live="polite"
    >
      <div
        className="idol-toast flex w-full max-w-[340px] items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow)]"
        data-testid="card-toast"
      >
        <Photocard
          src={card.src}
          frame={card.frame}
          size="sm"
          fallback={cardFallback(card)}
          ariaLabel={card.label}
        />
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--accent-ink)]">
            포토카드 획득
          </p>
          <p className="truncate text-[15px] font-bold text-[var(--ink)]">{card.label}</p>
          <p className="truncate text-[12px] text-[var(--ink-2)]">{card.sublabel}</p>
        </div>
      </div>
    </div>
  );
}
