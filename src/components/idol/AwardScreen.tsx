"use client";

/** 연말 시상식 — 수상 목록 연출 (12·24·36개월차) */

import { useEffect, useState } from "react";
import { bgSrc } from "@/game/idol/assets";
import { AWARD_LABELS, type AwardId, type AwardRecord } from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { Button, Card, SceneFallback } from "./ui";

const AWARD_TEXT: Record<AwardId, string> = {
  rookie: "올해의 신인. 이름을 부르는 순간 객석이 먼저 일어섰다.",
  bonsang: "본상 수상. 한 해 동안의 활동이 트로피 하나로 정리됐다.",
  daesang: "대상. 무대 위에서 하람은 한동안 말을 잇지 못했다.",
  popularity: "인기상. 투표수가 그대로 팬들의 목소리였다.",
};

const AWARD_COLOR: Record<AwardId, string> = {
  rookie: "#5EEAD4",
  bonsang: "#A78BFA",
  daesang: "#FBBF24",
  popularity: "#F9A8D4",
};

export function AwardScreen({
  awards,
  month,
  onConfirm,
}: {
  awards: AwardRecord[];
  month: number;
  onConfirm: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= awards.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), 520);
    return () => window.clearTimeout(id);
  }, [shown, awards.length]);

  const year = Math.floor((month - 1) / 12) + 1;

  return (
    <section className="flex flex-1 flex-col gap-3" data-testid="award-screen">
      <GameImage
        src={bgSrc("award_stage")}
        alt=""
        className="h-[130px] w-full rounded-2xl border border-[#2C3766]"
        fallback={<SceneFallback icon="🏆" label="AWARDS" />}
      />

      <div className="text-center">
        <h1 className="text-[20px] font-black">{year}년차 연말 시상식</h1>
        <p className="text-[12px] text-[#98A2CC]">한 해의 성적표가 호명된다.</p>
      </div>

      {awards.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-[13px] leading-7 text-[#C7CCEB]">
            올해는 객석에서 박수만 쳤다.
            <br />
            무대 위 이름들을 하람은 오래 바라봤다.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {awards.slice(0, shown).map((a) => (
            <li
              key={`${a.month}-${a.award}`}
              className="idol-fade-up rounded-2xl border px-3 py-3"
              style={{
                borderColor: `${AWARD_COLOR[a.award]}55`,
                backgroundColor: `${AWARD_COLOR[a.award]}12`,
              }}
            >
              <p className="text-[16px] font-black" style={{ color: AWARD_COLOR[a.award] }}>
                {AWARD_LABELS[a.award]}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-6 text-[#EEF0FF]">{AWARD_TEXT[a.award]}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-1">
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
    </section>
  );
}
