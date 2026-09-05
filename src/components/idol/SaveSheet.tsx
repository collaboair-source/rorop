"use client";

/** 저장 메뉴 바텀시트 (04 문서 3.11) — 슬롯 3개(포토카드 썸네일 행), 속도, 앨범, 타이틀로. */

import { useCallback, useEffect, useState } from "react";
import { formatFans } from "@/game/idol/engine";
import { portraitSrc } from "@/game/idol/assets";
import { SAVE_SLOTS, deleteSlot, listSlots, loadSlot, saveSlot } from "@/game/idol/save";
import { CAREER_PHASE_LABELS } from "@/game/idol/types";
import type { CareerPhase, GameSettings, GameState, PortraitStage, SaveSlotMeta } from "@/game/idol/types";
import { PortraitCard } from "./Photocard";
import { Button, ConfirmDialog, Sheet } from "./ui";
import { monthLabel, savedAtText } from "./format";

type Pending =
  | { kind: "overwrite"; slot: number }
  | { kind: "delete"; slot: number }
  | { kind: "exit" }
  | null;

function stageOf(phase: CareerPhase): PortraitStage {
  if (phase === "trainee") return "trainee";
  return phase === "rookie" ? "rookie" : "star";
}

export function SaveSheet({
  state,
  speed,
  onSpeedChange,
  onLoad,
  onClose,
  onExitToTitle,
  onAlbum,
  title = "메뉴",
}: {
  state: GameState | null;
  speed?: GameSettings["speed"];
  onSpeedChange?: (speed: GameSettings["speed"]) => void;
  onLoad: (loaded: GameState) => void;
  onClose: () => void;
  onExitToTitle?: () => void;
  onAlbum?: () => void;
  title?: string;
}) {
  const [slots, setSlots] = useState<Array<SaveSlotMeta | null>>([null, null, null]);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setSlots(listSlots());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const doSave = useCallback(
    (slot: number) => {
      if (!state) return;
      const ok = saveSlot(slot, state);
      setNotice(ok ? `슬롯 ${slot}에 저장했다.` : "저장에 실패했다. 브라우저 저장소를 확인해 주세요.");
      refresh();
    },
    [refresh, state],
  );

  const doDelete = useCallback(
    (slot: number) => {
      deleteSlot(slot);
      setNotice(`슬롯 ${slot}을 지웠다.`);
      refresh();
    },
    [refresh],
  );

  const doLoad = useCallback(
    (slot: number) => {
      const loaded = loadSlot(slot);
      if (!loaded) {
        setNotice("불러올 수 없는 저장 파일이다.");
        return;
      }
      onLoad(loaded);
    },
    [onLoad],
  );

  return (
    <>
      <Sheet title={title} onClose={onClose}>
        <ul className="space-y-2">
          {SAVE_SLOTS.map((slot) => {
            const meta = slots[slot - 1];
            const stage = meta ? stageOf(meta.phase) : "trainee";
            return (
              <li
                key={slot}
                className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-3"
                data-testid={`slot-row-${slot}`}
              >
                <div className="flex items-start gap-3">
                  <PortraitCard
                    stage={stage}
                    emotion="neutral"
                    src={portraitSrc(stage, "neutral")}
                    size="sm"
                    frame={stage === "star" ? "gold" : stage === "rookie" ? "silver" : "basic"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-extrabold text-[var(--ink)]">슬롯 {slot}</span>
                      <span className="num text-[11px] text-[var(--ink-3)]">
                        {meta ? savedAtText(meta.savedAt) : "비어 있음"}
                      </span>
                    </div>
                    {meta ? (
                      <p className="num mt-0.5 text-[12px] text-[var(--ink-2)]">
                        {meta.name} · {monthLabel(meta.month)} · {CAREER_PHASE_LABELS[meta.phase]} · 팬{" "}
                        {formatFans(meta.fans)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">저장된 기록이 없다.</p>
                    )}
                    <div className="mt-2 flex gap-1.5">
                      {state ? (
                        <Button
                          small
                          variant="secondary"
                          className="flex-1"
                          onClick={() => (meta ? setPending({ kind: "overwrite", slot }) : doSave(slot))}
                          testId={`save-${slot}`}
                        >
                          저장
                        </Button>
                      ) : null}
                      <Button
                        small
                        variant={meta ? "primary" : "secondary"}
                        className="flex-1"
                        disabled={!meta}
                        onClick={() => doLoad(slot)}
                        testId={`load-${slot}`}
                      >
                        불러오기
                      </Button>
                      <Button
                        small
                        variant="danger"
                        disabled={!meta}
                        onClick={() => setPending({ kind: "delete", slot })}
                        testId={`delete-${slot}`}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {notice ? <p className="mt-2 text-[12px] text-[var(--good)]">{notice}</p> : null}

        {speed && onSpeedChange ? (
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <p className="mb-1.5 text-[12px] font-extrabold tracking-[0.14em] text-[var(--ink-3)]">
              연출 속도
            </p>
            <div className="flex gap-2">
              <Button
                small
                className="flex-1"
                variant={speed === "normal" ? "primary" : "secondary"}
                onClick={() => onSpeedChange("normal")}
              >
                보통
              </Button>
              <Button
                small
                className="flex-1"
                variant={speed === "fast" ? "primary" : "secondary"}
                onClick={() => onSpeedChange("fast")}
                testId="speed-fast"
              >
                빠르게
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
          {onAlbum ? (
            <Button full variant="secondary" onClick={onAlbum} testId="menu-album">
              포토카드 앨범
            </Button>
          ) : null}
          {onExitToTitle ? (
            <>
              <Button
                full
                variant="ghost"
                onClick={() => setPending({ kind: "exit" })}
                testId="exit-title"
              >
                타이틀로 나가기
              </Button>
              <p className="text-center text-[11px] text-[var(--ink-3)]">
                진행 상황은 자동 저장되어 있어 언제든 이어할 수 있다.
              </p>
            </>
          ) : null}
        </div>
      </Sheet>

      {pending?.kind === "overwrite" ? (
        <ConfirmDialog
          title={`슬롯 ${pending.slot} 덮어쓰기`}
          message="이 슬롯의 기존 저장 파일이 사라진다. 계속할까?"
          confirmLabel="덮어쓰기"
          onConfirm={() => {
            doSave(pending.slot);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === "delete" ? (
        <ConfirmDialog
          title={`슬롯 ${pending.slot} 삭제`}
          message="지운 저장 파일은 되돌릴 수 없다."
          confirmLabel="삭제"
          danger
          onConfirm={() => {
            doDelete(pending.slot);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === "exit" && onExitToTitle ? (
        <ConfirmDialog
          title="타이틀로 나가기"
          message="지금까지의 진행은 자동 저장되어 있다. 타이틀 화면으로 나갈까?"
          confirmLabel="나가기"
          onConfirm={() => {
            setPending(null);
            onExitToTitle();
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}
