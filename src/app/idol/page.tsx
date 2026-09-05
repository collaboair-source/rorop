"use client";

/** 타이틀 (온스테이지, 04 문서 3.1) — 이어하기 / 새 게임 / 불러오기 / 포토카드 앨범 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFans, getEmotion, getPortraitStage } from "@/game/idol/engine";
import { portraitSrc, titleSrc } from "@/game/idol/assets";
import { loadAlbum, loadAuto, saveAuto } from "@/game/idol/save";
import { CAREER_PHASE_LABELS } from "@/game/idol/types";
import type { GameState } from "@/game/idol/types";
import { GameImage } from "@/components/idol/GameImage";
import { PortraitCard } from "@/components/idol/Photocard";
import { SaveSheet } from "@/components/idol/SaveSheet";
import { StageBackdrop } from "@/components/idol/StageBackdrop";
import { Button, ConfirmDialog, Icon } from "@/components/idol/ui";
import { CARD_TOTAL } from "@/components/idol/album";
import { monthLabel } from "@/components/idol/format";

export default function IdolTitlePage() {
  const router = useRouter();
  const [booted, setBooted] = useState(false);
  const [auto, setAuto] = useState<GameState | null>(null);
  const [ownedCount, setOwnedCount] = useState(0);
  const [loadOpen, setLoadOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    setAuto(loadAuto());
    setOwnedCount(loadAlbum().length);
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

  const stage = auto ? getPortraitStage(auto) : "trainee";
  const emotion = auto ? getEmotion(auto) : "neutral";

  return (
    <main className="stage relative flex flex-1 flex-col overflow-hidden">
      {/* 키비주얼 — 위 2/3, 아래로 갈수록 --bg 로 스크림 */}
      <div className="absolute inset-x-0 top-0 h-[62%]">
        <GameImage
          src={titleSrc()}
          alt=""
          className="absolute inset-0 h-full w-full"
          fallback={
            <span className="absolute inset-0 block bg-[var(--bg)]">
              <StageBackdrop beams={2} particles={90} />
            </span>
          }
        />
        <div className="scene-scrim" />
      </div>

      <div className="relative mt-auto flex flex-col px-5 pb-8 pt-[46vh]">
        <h1 className="display text-[44px] text-[var(--ink)]">별이 되어줘</h1>
        <p className="mt-1 text-[13px] font-bold tracking-[0.2em] text-[var(--accent-ink)]">
          남자 아이돌 키우기
        </p>
        <p className="mt-3 text-[13px] leading-6 text-[var(--ink-2)]">
          루미너스 엔터테인먼트의 신입 매니저.
          <br />
          연습생 한 명과 3년, 그리고 서른여섯 번의 선택.
        </p>

        <div className="mt-6 space-y-2.5">
          {booted && auto ? (
            <button
              type="button"
              onClick={() => router.push("/idol/play")}
              data-testid="continue"
              className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3 text-left transition-colors duration-[120ms] hover:bg-[var(--surface-2)]"
            >
              <PortraitCard
                stage={stage}
                emotion={emotion}
                src={portraitSrc(stage, emotion)}
                size="sm"
                frame={stage === "star" ? "gold" : stage === "rookie" ? "silver" : "basic"}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-extrabold tracking-[0.14em] text-[var(--accent-ink)]">
                  이어하기
                </span>
                <span className="block truncate text-[16px] font-extrabold text-[var(--ink)]">
                  {auto.idol.name} · {monthLabel(auto.month)}
                </span>
                <span className="num block truncate text-[12px] text-[var(--ink-2)]">
                  {CAREER_PHASE_LABELS[auto.career.phase]} · 팬 {formatFans(auto.idol.social.fans)}
                </span>
              </span>
              <span className="shrink-0 text-[var(--accent-ink)]">
                <Icon name="play" size={20} />
              </span>
            </button>
          ) : null}

          <Button
            full
            variant="primary"
            onClick={() => (auto ? setConfirmNew(true) : startNew())}
            testId="new-game"
          >
            새 게임
            <Icon name="play" size={16} />
          </Button>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setLoadOpen(true)}
              data-testid="open-load"
              className="min-h-[44px] flex-1 rounded-[14px] px-3 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
            >
              불러오기
            </button>
            <span className="h-4 w-px bg-[var(--line)]" aria-hidden="true" />
            <button
              type="button"
              onClick={() => router.push("/idol/album")}
              data-testid="open-album"
              className="min-h-[44px] flex-1 rounded-[14px] px-3 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
            >
              포토카드 앨범{" "}
              <span className="num text-[var(--ink-3)]">
                {booted ? `${ownedCount}/${CARD_TOTAL}` : ""}
              </span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-[var(--ink-3)]">
          진행은 이 브라우저에 저장된다. 시크릿 모드에서는 저장이 남지 않을 수 있다.
        </p>
      </div>

      {loadOpen ? (
        <SaveSheet
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
