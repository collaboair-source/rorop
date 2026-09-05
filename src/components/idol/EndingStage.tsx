"use client";

/** 엔딩 (온스테이지, 04 문서 3.9) — 일러스트 → 등급·제목 → 에필로그 → 최종 기록 → 카드 획득. */

import { formatFans } from "@/game/idol/engine";
import { endingSrc } from "@/game/idol/assets";
import {
  AWARD_LABELS,
  SKILL_IDS,
  type EndingDef,
  type EndingGrade,
  type GameState,
} from "@/game/idol/types";
import { Confetti } from "./Confetti";
import { GameImage } from "./GameImage";
import { Photocard, cardFallback } from "./Photocard";
import { RadarChart } from "./RadarChart";
import { Silhouette } from "./Silhouette";
import { StageBackdrop } from "./StageBackdrop";
import { Button, Card, Chip } from "./ui";
import { monthLabel, moneyText } from "./format";
import type { CardDef } from "./album";

const GRADE_COLOR: Record<EndingGrade, string> = {
  S: "var(--gold)",
  A: "var(--accent-ink)",
  B: "var(--ink)",
  C: "var(--ink-2)",
  D: "var(--ink-3)",
};

export function fillName(text: string, name: string): string {
  return text.split("{name}").join(name);
}

export function EndingStage({
  ending,
  state,
  card,
  onTitle,
  onAlbum,
}: {
  ending: EndingDef;
  state: GameState;
  card: CardDef | null;
  onTitle: () => void;
  onAlbum: () => void;
}) {
  const idol = state.idol;
  const endedMonth = state.ending ? state.ending.month : state.month;
  const lines = fillName(ending.text, idol.name)
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const stage = state.career.debuted ? (state.career.phase === "rookie" ? "rookie" : "star") : "trainee";

  return (
    <section className="stage relative flex flex-1 flex-col overflow-hidden" data-testid="ending-screen">
      <Confetti active={ending.grade === "S"} />

      <div className="relative h-[300px] w-full shrink-0">
        <GameImage
          src={endingSrc(ending.id)}
          alt={ending.title}
          className="absolute inset-0 h-full w-full"
          objectPosition="top"
          fallback={
            <span className="absolute inset-0 block">
              <span className="scene scene-beam" />
              <StageBackdrop beams={0} particles={50} floor={false} />
              <span className="absolute inset-x-0 bottom-0 mx-auto block h-[86%] w-[240px]">
                <Silhouette stage={stage} emotion="determined" size="full" badge={false} />
              </span>
            </span>
          }
        />
        <div className="scene-scrim" />
      </div>

      <div className="relative -mt-10 flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="text-center">
          <span
            className="inline-flex h-7 items-center rounded-full border px-3 text-[12px] font-extrabold"
            style={{ color: GRADE_COLOR[ending.grade], borderColor: GRADE_COLOR[ending.grade] }}
          >
            등급 {ending.grade}
          </span>
          <h1 className="display mt-2 text-[40px]" style={{ color: GRADE_COLOR[ending.grade] }}>
            {ending.title}
          </h1>
          <p className="text-[12px] text-[var(--ink-3)]">
            {monthLabel(endedMonth)} · {idol.name}의 이야기
          </p>
        </div>

        <div className="mt-2 space-y-2.5">
          {lines.map((line, i) => (
            <p
              key={i}
              className="idol-fade-in text-[15px] leading-[1.8] text-[var(--ink-2)]"
              style={{ animationDelay: `${i * 220}ms` }}
            >
              {line}
            </p>
          ))}
        </div>

        <Card className="mt-2">
          <div className="flex items-center gap-3">
            <RadarChart values={SKILL_IDS.map((id) => idol.skills[id])} size={124} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="num text-[13px] font-bold text-[var(--ink)]">
                팬 {formatFans(idol.social.fans)}
              </p>
              <p className="num text-[12px] text-[var(--ink-2)]">
                호감도 {Math.round(idol.social.bond)} · 평판 {Math.round(idol.social.reputation)}
              </p>
              <p className="num text-[12px] text-[var(--ink-2)]">자금 {moneyText(state.economy.money)}</p>
              <p className="text-[12px] leading-5 text-[var(--ink-3)]">
                {state.career.debuted
                  ? `${state.career.debutMonth}개월차 데뷔 · 컴백 ${state.career.comebacks.length}회 · 1위 ${state.career.topRankCount}회`
                  : "끝내 데뷔하지 못했다"}
              </p>
            </div>
          </div>
          {state.career.awards.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3">
              {state.career.awards.map((a, i) => (
                <Chip key={`${a.month}-${a.award}-${i}`} tone="gold">
                  {Math.floor((a.month - 1) / 12) + 1}년차 {AWARD_LABELS[a.award]}
                </Chip>
              ))}
            </div>
          ) : null}
        </Card>

        {card ? (
          <div className="mt-1 flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="idol-flip w-[76px]">
              <Photocard
                src={card.src}
                frame={card.frame}
                size="md"
                fallback={cardFallback(card)}
                ariaLabel={card.label}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-[var(--accent-ink)]">
                포토카드 획득
              </p>
              <p className="truncate text-[15px] font-bold text-[var(--ink)]">{card.label}</p>
              <p className="text-[12px] text-[var(--ink-2)]">앨범의 엔딩 탭에 남는다.</p>
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex gap-2 pt-3">
          <Button full variant="secondary" onClick={onTitle} testId="ending-title">
            타이틀로
          </Button>
          <Button full variant="primary" onClick={onAlbum} testId="ending-gallery">
            앨범 보기
          </Button>
        </div>
      </div>
    </section>
  );
}
