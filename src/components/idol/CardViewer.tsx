"use client";

/** 포토카드 전체 화면 뷰어 (04 문서 3.10) — 좌우 스와이프·버튼·키보드로 넘긴다. */

import { useCallback, useEffect, useRef } from "react";
import { Photocard, cardFallback } from "./Photocard";
import { Button, Icon } from "./ui";
import type { CardDef } from "./album";

export function CardViewer({
  cards,
  index,
  owned,
  meta,
  onIndex,
  onClose,
}: {
  cards: CardDef[];
  index: number;
  owned: ReadonlySet<string>;
  meta?: (card: CardDef) => string | null;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const card = cards[index];
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + cards.length) % cards.length;
      onIndex(next);
    },
    [cards.length, index, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!card) return null;
  const locked = !owned.has(card.id);
  const extra = meta ? meta(card) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={locked ? "잠긴 포토카드" : card.label}
      data-testid="card-viewer"
    >
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        onClick={onClose}
        className="viewer-veil absolute inset-0 backdrop-blur-[3px]"
      />
      <div
        className="relative flex w-full max-w-[480px] flex-col justify-center px-6 py-8"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX ?? null;
          touchX.current = null;
          if (start === null || end === null) return;
          if (Math.abs(end - start) < 40) return;
          go(end < start ? 1 : -1);
        }}
      >
        <div className="mx-auto w-full max-w-[260px]">
          <Photocard
            src={locked ? undefined : card.src}
            frame={card.frame}
            locked={locked}
            hint={card.hint}
            size="lg"
            fallback={cardFallback(card)}
            ariaLabel={locked ? card.hint : card.label}
          />
        </div>

        <div className="mt-4 text-center">
          <p className="text-[12px] font-bold tracking-[0.14em] text-[var(--ink-3)]">
            {card.sublabel}
          </p>
          <h2 className="mt-0.5 text-[20px] font-extrabold text-[var(--ink)]">
            {locked ? "???" : card.label}
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-[var(--ink-2)]">
            {locked ? card.hint : (extra ?? "앨범에 보관 중")}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="이전 카드"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
          >
            <Icon name="back" size={20} />
          </button>
          <span className="num text-[12px] text-[var(--ink-3)]">
            {index + 1} / {cards.length}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="다음 카드"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
          >
            <span className="rotate-180">
              <Icon name="back" size={20} />
            </span>
          </button>
        </div>

        <div className="mt-5">
          <Button full variant="secondary" onClick={onClose} testId="viewer-close">
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
