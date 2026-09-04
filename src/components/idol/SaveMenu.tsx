"use client";

/** 저장 메뉴 — 슬롯 3개(저장/불러오기/삭제, 확인 단계), 연출 속도 설정, 타이틀로 */

import { useCallback, useEffect, useState } from "react";
import { formatFans } from "@/game/idol/engine";
import {
  SAVE_SLOTS,
  deleteSlot,
  listSlots,
  loadSlot,
  saveSlot,
} from "@/game/idol/save";
import { CAREER_PHASE_LABELS } from "@/game/idol/types";
import type { GameSettings, GameState, SaveSlotMeta } from "@/game/idol/types";
import { monthLabel } from "./TopBar";
import { Button, ConfirmDialog, Sheet } from "./ui";

function savedAtText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Pending =
  | { kind: "overwrite"; slot: number }
  | { kind: "delete"; slot: number }
  | { kind: "exit" }
  | null;

export function SaveMenu({
  state,
  speed,
  onSpeedChange,
  onLoad,
  onClose,
  onExitToTitle,
  title = "메뉴",
}: {
  state: GameState | null;
  speed?: GameSettings["speed"];
  onSpeedChange?: (speed: GameSettings["speed"]) => void;
  onLoad: (loaded: GameState) => void;
  onClose: () => void;
  onExitToTitle?: () => void;
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
            return (
              <li
                key={slot}
                className="rounded-xl border border-[#2C3766] bg-[#141B33] px-3 py-2.5"
                data-testid={`slot-row-${slot}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold">슬롯 {slot}</span>
                  <span className="text-[11px] text-[#98A2CC]">
                    {meta ? savedAtText(meta.savedAt) : "비어 있음"}
                  </span>
                </div>
                {meta ? (
                  <p className="mt-0.5 text-[11.5px] text-[#C7CCEB]">
                    {meta.name} · {monthLabel(meta.month)} · {CAREER_PHASE_LABELS[meta.phase]} · 팬{" "}
                    {formatFans(meta.fans)}
                  </p>
                ) : null}
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
              </li>
            );
          })}
        </ul>

        {notice ? <p className="mt-2 text-[11.5px] text-[#5EEAD4]">{notice}</p> : null}

        {speed && onSpeedChange ? (
          <div className="mt-4 border-t border-[#242E52] pt-3">
            <p className="mb-1.5 text-[12px] font-bold text-[#A78BFA]">연출 속도</p>
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

        {onExitToTitle ? (
          <div className="mt-4 border-t border-[#242E52] pt-3">
            <Button full variant="ghost" onClick={() => setPending({ kind: "exit" })} testId="exit-title">
              타이틀로 나가기
            </Button>
            <p className="mt-1 text-center text-[11px] text-[#98A2CC]">
              진행 상황은 자동 저장되어 있어 언제든 이어할 수 있다.
            </p>
          </div>
        ) : null}
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
