"use client";

/** 데뷔 평가 (온스테이지, 04 문서 3.8) — 점수 카운트업 → 합격/불합격 → 심사평. */

import { CountUp } from "./CountUp";
import { Confetti } from "./Confetti";
import { StageBackdrop } from "./StageBackdrop";
import { Photocard, cardFallback } from "./Photocard";
import { Button } from "./ui";
import { monthLabel } from "./format";
import type { CardDef } from "./album";
import type { DebutEvalResult } from "@/game/idol/types";

const PASS_SCORE = 50;

export function DebutEvalStage({
  result,
  newCards,
  onConfirm,
}: {
  result: DebutEvalResult;
  newCards: CardDef[];
  onConfirm: () => void;
}) {
  return (
    <section className="stage relative flex flex-1 flex-col overflow-hidden" data-testid="debut-eval">
      <StageBackdrop />
      <Confetti active={result.passed} />

      <div className="relative flex flex-1 flex-col px-4 pb-6 pt-6">
        <p className="text-[12px] font-bold tracking-[0.2em] text-[var(--accent-ink)]">
          데뷔 평가 · {monthLabel(result.month)}
        </p>

        <div className="mt-8 text-center">
          <p className="text-[12px] font-bold tracking-[0.2em] text-[var(--ink-2)]">종합 점수</p>
          <p
            className="display mt-1 text-[64px] text-[var(--ink)]"
            data-testid="debut-score"
          >
            <CountUp value={result.score} digits={1} />
          </p>
          <p className="num text-[12px] text-[var(--ink-3)]">합격선 {PASS_SCORE}</p>

          <p
            className="display mt-6 text-[40px]"
            style={{ color: result.passed ? "var(--gold)" : "var(--ink-2)" }}
          >
            {result.passed ? "합격" : "불합격"}
          </p>
        </div>

        <p className="mt-6 whitespace-pre-line text-center text-[15px] leading-[1.8] text-[var(--ink-2)]">
          {result.text}
        </p>

        <p className="mt-3 text-center text-[13px] leading-6 text-[var(--ink-3)]">
          {result.passed
            ? "쇼케이스 날짜가 잡혔다. 이제부터는 무대에서 증명하는 일만 남았다."
            : "다음 신청은 두 달 뒤부터 가능하다. 부족한 곳은 이미 알고 있다."}
        </p>

        {newCards.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {newCards.map((card) => (
              <div key={card.id} className="idol-flip w-[84px]">
                <Photocard
                  src={card.src}
                  frame={card.frame}
                  label={card.label}
                  size="md"
                  fallback={cardFallback(card)}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-auto pt-8">
          <Button full variant="primary" onClick={onConfirm} testId="debut-confirm">
            확인
          </Button>
        </div>
      </div>
    </section>
  );
}
