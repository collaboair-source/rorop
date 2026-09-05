"use client";

/**
 * 컴백 (온스테이지, 04 문서 3.8).
 * 1단계 — 앨범 재킷 카드 5장 + 포커스 3버튼. 2단계 — 차트 성적.
 */

import { useState } from "react";
import { formatFans } from "@/game/idol/engine";
import { COMEBACK_FOCUS_LABELS, CONCEPTS } from "@/game/idol/data/concepts";
import type {
  ComebackFocus,
  ComebackRank,
  ComebackRecord,
  ConceptId,
  GameState,
} from "@/game/idol/types";
import { Confetti } from "./Confetti";
import { CountUp } from "./CountUp";
import { Photocard, cardFallback } from "./Photocard";
import { StageBackdrop } from "./StageBackdrop";
import { Button, Chip } from "./ui";
import { monthLabel, signed } from "./format";
import type { CardDef } from "./album";

const RANK_LABEL: Record<ComebackRank, string> = {
  top1: "1위",
  top10: "TOP 10",
  top50: "TOP 50",
  fail: "진입 실패",
};

const JACKET_CLASS: Record<ConceptId, string> = {
  fresh: "jacket-fresh",
  sexy: "jacket-sexy",
  hiphop: "jacket-hiphop",
  ballad: "jacket-ballad",
  performance: "jacket-performance",
};

const FOCUS_ORDER: ComebackFocus[] = ["vocal", "dance", "rap"];

function ResultView({
  record,
  newCards,
  onConfirm,
}: {
  record: ComebackRecord;
  newCards: CardDef[];
  onConfirm: () => void;
}) {
  const top1 = record.rank === "top1";
  return (
    <section className="stage relative flex flex-1 flex-col overflow-hidden" data-testid="comeback-result">
      <StageBackdrop />
      <Confetti active={top1} />

      <div className="relative flex flex-1 flex-col px-4 pb-6 pt-6">
        <p className="text-[12px] font-bold tracking-[0.2em] text-[var(--accent-ink)]">
          컴백 · {monthLabel(record.month)}
        </p>

        <div className="mt-8 text-center">
          <p className="text-[12px] font-bold tracking-[0.2em] text-[var(--ink-2)]">차트 성적</p>
          <p
            className="display mt-1 text-[64px]"
            style={{ color: top1 ? "var(--gold)" : "var(--ink)" }}
            data-testid="comeback-rank"
          >
            {RANK_LABEL[record.rank]}
          </p>
          <p className="num text-[13px] text-[var(--ink-3)]">
            점수 <CountUp value={record.score} digits={1} />
          </p>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          <Chip tone={record.fansGained >= 0 ? "good" : "bad"}>
            팬 {record.fansGained >= 0 ? "+" : "−"}
            {formatFans(Math.abs(record.fansGained))}
          </Chip>
          <Chip tone={record.moneyGained >= 0 ? "good" : "bad"}>
            활동 수익 {signed(record.moneyGained)}만
          </Chip>
        </div>

        <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.8] text-[var(--ink-2)]">
          {record.text}
        </p>

        {newCards.length > 0 ? (
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
          <Button full variant="primary" onClick={onConfirm} testId="comeback-confirm">
            확인
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ComebackStage({
  state,
  newCards,
  onChoose,
  onConfirm,
}: {
  state: GameState;
  newCards: CardDef[];
  onChoose: (concept: ConceptId, focus: ComebackFocus) => void;
  onConfirm: () => void;
}) {
  const [concept, setConcept] = useState<ConceptId | null>(null);
  const [focus, setFocus] = useState<ComebackFocus | null>(null);

  const record = state.ui.lastComeback;
  if (record && record.month === state.month) {
    return <ResultView record={record} newCards={newCards} onConfirm={onConfirm} />;
  }

  const selfProduced = state.flags.self_produced === true;

  return (
    <section className="stage relative flex flex-1 flex-col overflow-hidden" data-testid="comeback-select">
      <StageBackdrop beams={2} particles={40} />

      <div className="relative flex flex-1 flex-col px-4 pb-6 pt-6">
        <p className="text-[12px] font-bold tracking-[0.2em] text-[var(--accent-ink)]">
          컴백 준비 · {monthLabel(state.month)}
        </p>
        <h1 className="display mt-1 text-[40px] text-[var(--ink)]">타이틀곡</h1>

        {selfProduced ? (
          <p className="mt-2 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] leading-6 text-[var(--accent-ink)]">
            이번 타이틀곡은 {state.idol.name}의 자작곡이다. 포커스 능력치가 높으면 크게 터지고, 아니면
            반대가 된다.
          </p>
        ) : null}

        <p className="mb-2 mt-5 text-[12px] font-bold tracking-[0.14em] text-[var(--ink-3)]">콘셉트</p>
        <ul className="idol-hscroll idol-no-scrollbar -mx-4 px-4 pb-1">
          {CONCEPTS.map((c) => {
            const on = concept === c.id;
            return (
              <li key={c.id} className="w-[124px]">
                <button
                  type="button"
                  onClick={() => setConcept(c.id)}
                  data-testid={`concept-${c.id}`}
                  className={[
                    "block w-full rounded-[16px] p-1 text-left transition-colors duration-[120ms]",
                    on ? "bg-[var(--accent)]" : "bg-transparent",
                  ].join(" ")}
                >
                  <span
                    className={`${JACKET_CLASS[c.id]} relative block aspect-[3/4] w-full overflow-hidden rounded-[14px]`}
                  >
                    <span className="absolute inset-x-0 bottom-0 block bg-[var(--scrim)] px-2 py-1.5">
                      <span className="on-media block text-[14px] font-extrabold">{c.label}</span>
                      <span className="on-media-2 block truncate text-[10px] leading-4">
                        {c.tagline}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 mt-5 text-[12px] font-bold tracking-[0.14em] text-[var(--ink-3)]">
          타이틀곡 포커스
        </p>
        <div className="flex gap-2">
          {FOCUS_ORDER.map((f) => {
            const on = focus === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFocus(f)}
                data-testid={`focus-${f}`}
                className={[
                  "min-h-[52px] flex-1 rounded-[14px] border text-[14px] font-bold transition-colors duration-[120ms]",
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
                ].join(" ")}
              >
                {COMEBACK_FOCUS_LABELS[f]}{" "}
                <span className="num text-[12px] text-[var(--ink-3)]">
                  {Math.round(state.idol.skills[f])}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto pt-8">
          <Button
            full
            variant="primary"
            disabled={!concept || !focus}
            onClick={() => {
              if (concept && focus) onChoose(concept, focus);
            }}
            testId="comeback-release"
          >
            발매
          </Button>
        </div>
      </div>
    </section>
  );
}
