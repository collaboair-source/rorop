"use client";

/** 엔딩 — 일러스트 + 에필로그 + 최종 스탯 요약 + 획득 상 목록 */

import { formatFans } from "@/game/idol/engine";
import { endingSrc } from "@/game/idol/assets";
import {
  AWARD_LABELS,
  SKILL_IDS,
  SKILL_LABELS,
  type EndingDef,
  type EndingGrade,
  type GameState,
} from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { monthLabel } from "./TopBar";
import { Button, Card, SectionTitle } from "./ui";

export const GRADE_COLOR: Record<EndingGrade, string> = {
  S: "#FBBF24",
  A: "#A78BFA",
  B: "#5EEAD4",
  C: "#93C5FD",
  D: "#F87171",
};

export const ENDING_FALLBACK_GRADIENT: Record<EndingGrade, string> = {
  S: "linear-gradient(160deg, #4A3A10 0%, #0B1020 100%)",
  A: "linear-gradient(160deg, #3B2F6B 0%, #0B1020 100%)",
  B: "linear-gradient(160deg, #14453F 0%, #0B1020 100%)",
  C: "linear-gradient(160deg, #1E3050 0%, #0B1020 100%)",
  D: "linear-gradient(160deg, #3A1C24 0%, #0B1020 100%)",
};

export function fillName(text: string, name: string): string {
  return text.split("{name}").join(name);
}

export function EndingScreen({
  ending,
  state,
  onTitle,
  onGallery,
}: {
  ending: EndingDef;
  state: GameState;
  onTitle: () => void;
  onGallery: () => void;
}) {
  const idol = state.idol;
  const endedMonth = state.ending ? state.ending.month : state.month;

  return (
    <section className="flex flex-1 flex-col gap-3 px-3 py-4" data-testid="ending-screen">
      <GameImage
        src={endingSrc(ending.id)}
        alt={ending.title}
        className="h-[180px] w-full rounded-2xl border border-[#2C3766]"
        fallback={
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: ENDING_FALLBACK_GRADIENT[ending.grade] }}
          >
            <span
              className="text-[54px] font-black opacity-40"
              style={{ color: GRADE_COLOR[ending.grade] }}
            >
              {ending.grade}
            </span>
          </div>
        }
      />

      <div className="text-center">
        <p className="text-[12px] text-[#98A2CC]">
          {monthLabel(endedMonth)} · {idol.name}의 이야기
        </p>
        <h1 className="mt-0.5 text-[24px] font-black" style={{ color: GRADE_COLOR[ending.grade] }}>
          {ending.title}
        </h1>
        <p className="text-[12px] font-bold text-[#98A2CC]">등급 {ending.grade}</p>
      </div>

      <Card>
        <p className="whitespace-pre-line text-[13px] leading-7 text-[#EEF0FF]">
          {fillName(ending.text, idol.name)}
        </p>
      </Card>

      <Card>
        <SectionTitle right={`팬 ${formatFans(idol.social.fans)}`}>최종 기록</SectionTitle>
        <div className="grid grid-cols-3 gap-x-2 gap-y-1">
          {SKILL_IDS.map((id) => (
            <div key={id} className="flex items-baseline justify-between">
              <span className="text-[11px] text-[#98A2CC]">{SKILL_LABELS[id]}</span>
              <span className="text-[12px] font-bold tabular-nums">{Math.round(idol.skills[id])}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 border-t border-[#242E52] pt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-[#98A2CC]">호감도</span>
            <span className="text-[12px] font-bold tabular-nums">{Math.round(idol.social.bond)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-[#98A2CC]">평판</span>
            <span className="text-[12px] font-bold tabular-nums">
              {Math.round(idol.social.reputation)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-[#98A2CC]">자금</span>
            <span className="text-[12px] font-bold tabular-nums">
              {state.economy.money.toLocaleString("ko-KR")}만
            </span>
          </div>
        </div>
        <p className="mt-2 border-t border-[#242E52] pt-2 text-[11.5px] text-[#C7CCEB]">
          {state.career.debuted
            ? `${state.career.debutMonth}개월차 데뷔 · 컴백 ${state.career.comebacks.length}회 · 1위 ${state.career.topRankCount}회`
            : "끝내 데뷔하지 못했다"}
        </p>
      </Card>

      <Card>
        <SectionTitle>수상</SectionTitle>
        {state.career.awards.length === 0 ? (
          <p className="text-[12px] text-[#98A2CC]">수상 기록 없음</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {state.career.awards.map((a, i) => (
              <li
                key={`${a.month}-${a.award}-${i}`}
                className="rounded-full border border-[#3B2F6B] bg-[#1F1B3D] px-2 py-0.5 text-[11px] font-semibold text-[#A78BFA]"
              >
                {Math.floor((a.month - 1) / 12) + 1}년차 {AWARD_LABELS[a.award]}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-[12px] font-semibold text-[#5EEAD4]">엔딩 도감에 기록됨</p>

      <div className="mt-auto flex gap-2 pt-1">
        <Button full variant="secondary" onClick={onTitle} testId="ending-title">
          타이틀로
        </Button>
        <Button full variant="primary" onClick={onGallery} testId="ending-gallery">
          도감 보기
        </Button>
      </div>
    </section>
  );
}
