"use client";

/** 이벤트 모달 — 배경/CG + 포트레이트 + 본문 + 선택지. 선택 후에는 결과 문구를 보여준다. */

import { getEmotion, getPortraitStage } from "@/game/idol/engine";
import { bgSrc, cgSrc } from "@/game/idol/assets";
import type { GameEventDef, GameState } from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { Portrait } from "./Portrait";
import { Button, Overlay, SceneFallback } from "./ui";

export function EventModal({
  event,
  state,
  resultText,
  onChoose,
  onConfirmResult,
}: {
  event: GameEventDef;
  state: GameState;
  resultText: string | null;
  onChoose: (choiceId: string) => void;
  onConfirmResult: () => void;
}) {
  const emotion = event.emotion ?? getEmotion(state);
  const media = event.cg ? cgSrc(event.cg) : event.bg ? bgSrc(event.bg) : null;

  return (
    <Overlay labelledBy="idol-event-title">
      <div className="idol-fade-up flex max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-[#3B2F6B] bg-[#101736] shadow-2xl">
        <div className="relative">
          <GameImage
            src={media ?? bgSrc("practice_room")}
            alt=""
            className="h-[110px] w-full"
            fallback={<SceneFallback icon={event.cg ? "✦" : "◆"} />}
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#101736] to-transparent" />
          <div className="absolute bottom-2 right-3">
            <Portrait
              stage={getPortraitStage(state)}
              emotion={emotion}
              name={state.idol.name}
              size="sm"
            />
          </div>
          <h2
            id="idol-event-title"
            className="absolute bottom-3 left-3 max-w-[62%] text-[16px] font-black leading-tight text-[#EEF0FF] drop-shadow"
          >
            {event.title}
          </h2>
        </div>

        <div className="idol-no-scrollbar flex-1 overflow-y-auto overscroll-contain p-3">
          <p className="whitespace-pre-line text-[13px] leading-7 text-[#EEF0FF]">{event.text}</p>

          {resultText ? (
            <div className="mt-3 rounded-xl border border-[#3B2F6B] bg-[#161E3A] px-3 py-2.5">
              <p className="whitespace-pre-line text-[13px] leading-7 text-[#5EEAD4]">{resultText}</p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#242E52] p-3">
          {resultText ? (
            <Button full variant="primary" onClick={onConfirmResult} testId="event-confirm">
              계속
            </Button>
          ) : (
            <ul className="space-y-2">
              {event.choices.map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    onClick={() => onChoose(choice.id)}
                    data-testid={`choice-${choice.id}`}
                    className="min-h-[44px] w-full rounded-xl border border-[#2C3766] bg-[#1B2444] px-3 py-2.5 text-left transition-colors hover:bg-[#222D57] active:bg-[#1A2340]"
                  >
                    <span className="block text-[13.5px] font-semibold leading-6 text-[#EEF0FF]">
                      {choice.label}
                    </span>
                    {choice.hint ? (
                      <span className="mt-0.5 block text-[11px] text-[#A78BFA]">{choice.hint}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Overlay>
  );
}
