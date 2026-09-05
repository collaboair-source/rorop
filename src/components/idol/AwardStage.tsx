"use client";

/** 연말 시상식 (온스테이지, 04 문서 3.8) — 수상 트로피 카드 세로 나열. */

import { useEffect, useState } from "react";
import { AWARD_LABELS, type AwardId, type AwardRecord } from "@/game/idol/types";
import { Confetti } from "./Confetti";
import { Photocard, cardFallback } from "./Photocard";
import { StageBackdrop } from "./StageBackdrop";
import { Button } from "./ui";
import { yearLabel } from "./format";
import type { CardDef } from "./album";

const AWARD_TEXT: Record<AwardId, string> = {
  rookie: "올해의 신인. 이름을 부르는 순간 객석이 먼저 일어섰다.",
  bonsang: "본상 수상. 한 해 동안의 활동이 트로피 하나로 정리됐다.",
  daesang: "대상. 무대 위에서 한동안 말을 잇지 못했다.",
  popularity: "인기상. 투표수가 그대로 팬들의 목소리였다.",
};

export function AwardStage({
  awards,
  month,
  newCards,
  onConfirm,
}: {
  awards: AwardRecord[];
  month: number;
  newCards: CardDef[];
  onConfirm: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= awards.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), 520);
    return () => window.clearTimeout(id);
  }, [shown, awards.length]);

  const daesang = awards.some((a) => a.award === "daesang");

  return (
    <section className="stage relative flex flex-1 flex-col overflow-hidden" data-testid="award-screen">
      <StageBackdrop />
      <Confetti active={daesang} />

      <div className="relative flex flex-1 flex-col px-4 pb-6 pt-6">
        <p className="text-[12px] font-bold tracking-[0.2em] text-[var(--accent-ink)]">
          연말 시상식 · {yearLabel(month)}
        </p>
        <h1 className="display mt-1 text-[40px] text-[var(--ink)]">시상식</h1>

        {awards.length === 0 ? (
          <p className="mt-10 text-center text-[15px] leading-[1.9] text-[var(--ink-2)]">
            올해는 객석에서 박수만.
          </p>
        ) : (
          <ul className="mt-6 space-y-2.5">
            {awards.slice(0, shown).map((a) => {
              const gold = a.award === "daesang";
              return (
                <li
                  key={`${a.month}-${a.award}`}
                  className={[
                    "trophy-card idol-fade-up flex items-center gap-3 rounded-[20px] border p-3.5",
                    gold ? "border-[var(--gold)]" : "border-[var(--line)]",
                  ].join(" ")}
                >
                  <span className="text-[28px] leading-none" aria-hidden="true">
                    🏆
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[17px] font-extrabold"
                      style={{ color: gold ? "var(--gold)" : "var(--ink)" }}
                    >
                      {AWARD_LABELS[a.award]}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-6 text-[var(--ink-2)]">
                      {AWARD_TEXT[a.award]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {newCards.length > 0 && shown >= awards.length ? (
          <div className="mt-6">
            <p className="mb-2 text-center text-[11px] font-extrabold tracking-[0.14em] text-[var(--accent-ink)]">
              포토카드 획득
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
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
          </div>
        ) : null}

        <div className="mt-auto pt-8">
          <Button
            full
            variant="primary"
            disabled={shown < awards.length}
            onClick={onConfirm}
            testId="award-confirm"
          >
            {shown < awards.length ? "…" : "확인"}
          </Button>
        </div>
      </div>
    </section>
  );
}
