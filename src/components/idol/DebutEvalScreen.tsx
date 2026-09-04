"use client";

/** 데뷔 평가 결과 — 점수 연출 + 통과/실패 */

import { useEffect, useState } from "react";
import { bgSrc, cgSrc } from "@/game/idol/assets";
import type { DebutEvalResult, PortraitStage } from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { Portrait } from "./Portrait";
import { Button, Card, SceneFallback } from "./ui";

const PASS_SCORE = 50;

export function DebutEvalScreen({
  result,
  name,
  stage,
  onConfirm,
}: {
  result: DebutEvalResult;
  name: string;
  stage: PortraitStage;
  onConfirm: () => void;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setFilled(true), 60);
    return () => window.clearTimeout(id);
  }, []);

  const pct = Math.max(0, Math.min(100, result.score));

  return (
    <section className="flex flex-1 flex-col gap-3" data-testid="debut-eval">
      <GameImage
        src={result.passed ? cgSrc("debut_showcase") : bgSrc("practice_room")}
        alt=""
        className="h-[120px] w-full rounded-2xl border border-[#2C3766]"
        fallback={
          <SceneFallback icon={result.passed ? "🎤" : "🚪"} label={result.passed ? "SHOWCASE" : "AUDITION"} />
        }
      />

      <div>
        <h1 className="text-[20px] font-black">데뷔 평가</h1>
        <p className="text-[12px] text-[#98A2CC]">대표와 트레이너 앞에서의 단 한 번의 무대.</p>
      </div>

      <Card>
        <div className="flex items-end justify-between">
          <span className="text-[12px] text-[#98A2CC]">종합 점수</span>
          <span
            className="text-[34px] font-black leading-none tabular-nums"
            style={{ color: result.passed ? "#5EEAD4" : "#F87171" }}
            data-testid="debut-score"
          >
            {result.score.toFixed(1)}
          </span>
        </div>
        <div className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-[#0E1533]">
          <div
            className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
            style={{
              width: filled ? `${pct}%` : "0%",
              backgroundColor: result.passed ? "#5EEAD4" : "#F87171",
            }}
          />
          <div
            className="absolute top-0 h-full w-[2px] bg-[#EEF0FF]/70"
            style={{ left: `${PASS_SCORE}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[11px] text-[#98A2CC]">합격선 {PASS_SCORE}</p>
      </Card>

      <div
        className="rounded-2xl border px-3 py-3 text-center"
        style={{
          borderColor: result.passed ? "#5EEAD455" : "#F8717155",
          backgroundColor: result.passed ? "#0F2B2A" : "#2A1420",
        }}
      >
        <p
          className="text-[18px] font-black"
          style={{ color: result.passed ? "#5EEAD4" : "#F87171" }}
        >
          {result.passed ? "데뷔 확정" : "불합격"}
        </p>
        <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-[#EEF0FF]">{result.text}</p>
      </div>

      <div className="flex items-end gap-2">
        <Portrait
          stage={stage}
          emotion={result.passed ? "excited" : "sad"}
          name={name}
          size="sm"
        />
        <p className="flex-1 rounded-2xl border border-[#2C3766] bg-[#161E3A] px-3 py-2.5 text-[13px] leading-6">
          {result.passed
            ? "쇼케이스 날짜가 잡혔다. 이제부터는 무대에서 증명하는 일만 남았다."
            : "다음 신청은 두 달 뒤부터 가능하다. 부족한 곳은 이미 알고 있다."}
        </p>
      </div>

      <div className="mt-auto pt-1">
        <Button full variant="primary" onClick={onConfirm} testId="debut-confirm">
          확인
        </Button>
      </div>
    </section>
  );
}
