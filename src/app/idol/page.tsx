"use client";

/** 타이틀 — 새 게임 / 이어하기 / 불러오기 / 엔딩 도감 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFans } from "@/game/idol/engine";
import { titleSrc, logoSrc } from "@/game/idol/assets";
import { loadAuto, loadEndings, saveAuto } from "@/game/idol/save";
import { CAREER_PHASE_LABELS, ENDING_IDS } from "@/game/idol/types";
import type { GameState } from "@/game/idol/types";
import { GameImage } from "@/components/idol/GameImage";
import { SaveMenu } from "@/components/idol/SaveMenu";
import { monthLabel } from "@/components/idol/TopBar";
import { Button, ConfirmDialog } from "@/components/idol/ui";

export default function IdolTitlePage() {
  const router = useRouter();
  const [booted, setBooted] = useState(false);
  const [auto, setAuto] = useState<GameState | null>(null);
  const [endingCount, setEndingCount] = useState(0);
  const [loadOpen, setLoadOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    setAuto(loadAuto());
    setEndingCount(loadEndings().length);
    setBooted(true);
  }, []);

  const startNew = useCallback(() => {
    router.push("/idol/new");
  }, [router]);

  const handleLoad = useCallback(
    (loaded: GameState) => {
      saveAuto(loaded);
      router.push("/idol/play");
    },
    [router],
  );

  return (
    <main className="flex flex-1 flex-col px-4 pb-6 pt-5">
      <GameImage
        src={titleSrc()}
        alt="별이 되어줘 키비주얼"
        className="h-[260px] w-full rounded-3xl border border-[#2C3766]"
        fallback={
          <div className="idol-starfield flex h-full w-full items-end justify-center pb-5">
            <span className="text-[46px] leading-none opacity-70" aria-hidden="true">
              ⭐
            </span>
          </div>
        }
      />

      <div className="mt-4 text-center">
        <GameImage
          src={logoSrc()}
          alt="별이 되어줘 로고"
          objectFit="contain"
          className="mx-auto h-[54px] w-full max-w-[320px]"
          fallback={
            <div className="flex h-full w-full flex-col items-center justify-center">
              <h1 className="text-[26px] font-black tracking-tight text-[#EEF0FF]">별이 되어줘</h1>
            </div>
          }
        />
        <p className="mt-1.5 text-[12px] tracking-[0.2em] text-[#A78BFA]">남자 아이돌 키우기</p>
        <p className="mt-2 text-[12px] leading-6 text-[#98A2CC]">
          루미너스 엔터테인먼트의 신입 매니저.
          <br />
          연습생 한 명과 3년, 그리고 서른여섯 번의 선택.
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <Button
          full
          variant="primary"
          onClick={() => (auto ? setConfirmNew(true) : startNew())}
          testId="new-game"
        >
          새 게임
        </Button>

        {booted && auto ? (
          <Button full variant="secondary" onClick={() => router.push("/idol/play")} testId="continue">
            이어하기
            <span className="ml-1 text-[11px] font-normal text-[#98A2CC]">
              {auto.idol.name} · {monthLabel(auto.month)} · {CAREER_PHASE_LABELS[auto.career.phase]} · 팬{" "}
              {formatFans(auto.idol.social.fans)}
            </span>
          </Button>
        ) : null}

        <Button full variant="secondary" onClick={() => setLoadOpen(true)} testId="open-load">
          불러오기
        </Button>

        <Button full variant="ghost" onClick={() => router.push("/idol/endings")} testId="open-endings">
          엔딩 도감
          <span className="ml-1 text-[11px] text-[#98A2CC]">
            {endingCount}/{ENDING_IDS.length}
          </span>
        </Button>
      </div>

      <p className="mt-auto pt-6 text-center text-[10.5px] leading-5 text-[#4E5680]">
        진행은 이 브라우저에 저장된다. 시크릿 모드에서는 저장이 남지 않을 수 있다.
      </p>

      {loadOpen ? (
        <SaveMenu
          title="불러오기"
          state={null}
          onLoad={handleLoad}
          onClose={() => setLoadOpen(false)}
        />
      ) : null}

      {confirmNew ? (
        <ConfirmDialog
          title="새 게임"
          message="진행 중인 게임이 있다. 새로 시작하면 자동 저장이 새 게임으로 덮어써진다. 계속할까?"
          confirmLabel="새로 시작"
          onConfirm={() => {
            setConfirmNew(false);
            startNew();
          }}
          onCancel={() => setConfirmNew(false)}
        />
      ) : null}
    </main>
  );
}
