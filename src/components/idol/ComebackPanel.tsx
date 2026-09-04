"use client";

/** 컴백 — 콘셉트 5카드 + 포커스 3버튼 → 발표 → 결과 */

import { useState } from "react";
import { formatFans } from "@/game/idol/engine";
import { cgSrc } from "@/game/idol/assets";
import { COMEBACK_FOCUS_LABELS, CONCEPTS } from "@/game/idol/data/concepts";
import type {
  ComebackFocus,
  ComebackRank,
  ComebackRecord,
  ConceptId,
  GameState,
} from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { monthLabel } from "./TopBar";
import { Button, Card, Delta, SceneFallback, SectionTitle } from "./ui";

const RANK_LABEL: Record<ComebackRank, string> = {
  top1: "음원·음악방송 1위",
  top10: "차트 10위권",
  top50: "차트 50위권",
  fail: "차트 진입 실패",
};

const RANK_COLOR: Record<ComebackRank, string> = {
  top1: "#FBBF24",
  top10: "#5EEAD4",
  top50: "#A78BFA",
  fail: "#F87171",
};

const FOCUS_ORDER: ComebackFocus[] = ["vocal", "dance", "rap"];

function ResultView({
  record,
  onConfirm,
}: {
  record: ComebackRecord;
  onConfirm: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-3" data-testid="comeback-result">
      <GameImage
        src={record.rank === "top1" ? cgSrc("first_win") : cgSrc("comeback_stage")}
        alt=""
        className="h-[130px] w-full rounded-2xl border border-[#2C3766]"
        fallback={
          <SceneFallback icon={record.rank === "top1" ? "🏆" : "💿"} label="COMEBACK STAGE" />
        }
      />
      <div className="text-center">
        <p className="text-[12px] text-[#98A2CC]">{monthLabel(record.month)} 컴백 결과</p>
        <p className="text-[24px] font-black" style={{ color: RANK_COLOR[record.rank] }}>
          {RANK_LABEL[record.rank]}
        </p>
        <p className="text-[12px] text-[#98A2CC]">점수 {record.score.toFixed(1)}</p>
      </div>

      <Card>
        <p className="whitespace-pre-line text-[13px] leading-7 text-[#EEF0FF]">{record.text}</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between py-0.5">
          <span className="text-[12px] text-[#98A2CC]">팬</span>
          <span className="text-[13px] font-bold" style={{ color: record.fansGained >= 0 ? "#5EEAD4" : "#F87171" }}>
            {record.fansGained >= 0 ? "+" : "−"}
            {formatFans(Math.abs(record.fansGained))}
          </span>
        </div>
        <div className="flex items-center justify-between py-0.5">
          <span className="text-[12px] text-[#98A2CC]">활동 수익</span>
          <Delta value={record.moneyGained} suffix="만" hideZero={false} />
        </div>
      </Card>

      <div className="mt-auto pt-1">
        <Button full variant="primary" onClick={onConfirm} testId="comeback-confirm">
          확인
        </Button>
      </div>
    </section>
  );
}

export function ComebackPanel({
  state,
  onChoose,
  onConfirm,
}: {
  state: GameState;
  onChoose: (concept: ConceptId, focus: ComebackFocus) => void;
  onConfirm: () => void;
}) {
  const [concept, setConcept] = useState<ConceptId | null>(null);
  const [focus, setFocus] = useState<ComebackFocus | null>(null);

  const record = state.ui.lastComeback;
  if (record && record.month === state.month) {
    return <ResultView record={record} onConfirm={onConfirm} />;
  }

  const selfProduced = state.flags.self_produced === true;

  return (
    <section className="flex flex-1 flex-col gap-3" data-testid="comeback-select">
      <div>
        <h1 className="text-[20px] font-black">컴백 준비</h1>
        <p className="text-[12px] text-[#98A2CC]">
          {monthLabel(state.month)} · 콘셉트와 타이틀곡 포커스를 정한다.
        </p>
      </div>

      {selfProduced ? (
        <p className="rounded-xl border border-[#3B2F6B] bg-[#1F1B3D] px-3 py-2 text-[12px] leading-6 text-[#A78BFA]">
          이번 타이틀곡은 하람의 자작곡이다. 포커스 능력치가 높으면 크게 터지고, 아니면 반대가 된다.
        </p>
      ) : null}

      <div>
        <SectionTitle>콘셉트</SectionTitle>
        <ul className="space-y-2">
          {CONCEPTS.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setConcept(c.id)}
                data-testid={`concept-${c.id}`}
                className={[
                  "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                  concept === c.id
                    ? "border-[#A78BFA] bg-[#1F1B3D]"
                    : "border-[#2C3766] bg-[#141B33] hover:bg-[#1B2444]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold">{c.label}</span>
                  <span className="text-[11px] text-[#5EEAD4]">{c.tagline}</span>
                </div>
                <p className="mt-1 text-[11.5px] leading-5 text-[#98A2CC]">{c.description}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionTitle>타이틀곡 포커스</SectionTitle>
        <div className="flex gap-2">
          {FOCUS_ORDER.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFocus(f)}
              data-testid={`focus-${f}`}
              className={[
                "min-h-[44px] flex-1 rounded-xl border text-[13px] font-bold transition-colors",
                focus === f
                  ? "border-[#5EEAD4] bg-[#0F2B2A] text-[#5EEAD4]"
                  : "border-[#2C3766] bg-[#141B33] text-[#C7CCEB] hover:bg-[#1B2444]",
              ].join(" ")}
            >
              {COMEBACK_FOCUS_LABELS[f]}{" "}
              <span className="text-[11px] font-semibold text-[#98A2CC]">
                {Math.round(state.idol.skills[f])}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-1">
        <Button
          full
          variant="primary"
          disabled={!concept || !focus}
          onClick={() => {
            if (concept && focus) onChoose(concept, focus);
          }}
          testId="comeback-release"
        >
          발표
        </Button>
      </div>
    </section>
  );
}
