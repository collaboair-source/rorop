"use client";

/** 엔딩 도감 — 15칸. 획득한 것은 제목·등급·요약, 미획득은 실루엣과 힌트 한 줄. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEndingDef } from "@/game/idol/engine";
import { endingSrc } from "@/game/idol/assets";
import { loadEndings } from "@/game/idol/save";
import { ENDING_IDS } from "@/game/idol/types";
import type { EndingGalleryEntry, EndingId } from "@/game/idol/types";
import { GameImage } from "@/components/idol/GameImage";
import { ENDING_FALLBACK_GRADIENT, GRADE_COLOR } from "@/components/idol/EndingScreen";
import { monthLabel } from "@/components/idol/TopBar";
import { Badge, Button } from "@/components/idol/ui";

export default function IdolEndingsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, EndingGalleryEntry>>({});
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const map: Record<string, EndingGalleryEntry> = {};
    for (const e of loadEndings()) map[e.id] = e;
    setEntries(map);
    setBooted(true);
  }, []);

  const owned = ENDING_IDS.filter((id: EndingId) => Boolean(entries[id])).length;

  return (
    <main className="flex flex-1 flex-col px-3 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-black">엔딩 도감</h1>
          <p className="text-[12px] text-[#98A2CC]" data-testid="ending-count">
            {booted ? `${owned} / ${ENDING_IDS.length} 수집` : "불러오는 중…"}
          </p>
        </div>
        <Button small variant="ghost" onClick={() => router.push("/idol")} testId="back-title">
          타이틀로
        </Button>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2" data-testid="ending-grid">
        {ENDING_IDS.map((id: EndingId) => {
          const def = getEndingDef(id);
          const entry = entries[id];
          const found = Boolean(entry);
          return (
            <li
              key={id}
              className={[
                "flex flex-col overflow-hidden rounded-2xl border",
                found ? "border-[#2C3766] bg-[#141B33]" : "border-[#1E2643] bg-[#0F1428]",
              ].join(" ")}
            >
              <div className="relative h-[74px] w-full">
                {found ? (
                  <GameImage
                    src={endingSrc(id)}
                    alt={def.title}
                    className="h-full w-full"
                    fallback={
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ background: ENDING_FALLBACK_GRADIENT[def.grade] }}
                      >
                        <span
                          className="text-[26px] font-black opacity-45"
                          style={{ color: GRADE_COLOR[def.grade] }}
                        >
                          {def.grade}
                        </span>
                      </div>
                    }
                  />
                ) : (
                  // 미획득 칸은 이미지를 요청하지 않는다 (실루엣만)
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: "linear-gradient(160deg, #151B31 0%, #0B1020 100%)" }}
                  >
                    <span className="text-[26px] font-black text-[#3A4268] opacity-70">?</span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="flex items-start justify-between gap-1">
                  <h2
                    className={[
                      "text-[13px] font-bold leading-5",
                      found ? "text-[#EEF0FF]" : "text-[#4E5680]",
                    ].join(" ")}
                  >
                    {found ? def.title : "???"}
                  </h2>
                  {found ? <Badge color={GRADE_COLOR[def.grade]}>{def.grade}</Badge> : null}
                </div>
                <p
                  className={[
                    "text-[11px] leading-5",
                    found ? "text-[#C7CCEB]" : "italic text-[#5A6390]",
                  ].join(" ")}
                >
                  {found ? def.summary : def.hint}
                </p>
                {found && entry ? (
                  <p className="mt-auto pt-1 text-[10.5px] text-[#98A2CC]">
                    {entry.idolName} · {monthLabel(entry.month)}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-center text-[11px] leading-5 text-[#4E5680]">
        같은 엔딩을 다시 보면 기록이 최신으로 갱신된다.
      </p>
    </main>
  );
}
