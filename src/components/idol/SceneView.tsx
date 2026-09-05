"use client";

/**
 * 이벤트 장면 — 비주얼 노벨식 (04 문서 3.6).
 * 배경 id 가 무대 계열이면 루트에 .stage 를 붙여 온스테이지 토큰으로 바뀐다.
 */

import { getEmotion, getPortraitStage } from "@/game/idol/engine";
import { cgSrc } from "@/game/idol/assets";
import type { GameEventDef, GameState } from "@/game/idol/types";
import { GameImage } from "./GameImage";
import { HeroAvatar } from "./HeroScene";
import { SceneBg, isStageBg, sceneMotifClass } from "./SceneBg";
import { Button, Chip } from "./ui";

export function SceneView({
  event,
  state,
  resultText,
  chosenId,
  onChoose,
  onConfirmResult,
}: {
  event: GameEventDef;
  state: GameState;
  resultText: string | null;
  chosenId: string | null;
  onChoose: (choiceId: string) => void;
  onConfirmResult: () => void;
}) {
  const emotion = event.emotion ?? getEmotion(state);
  const stage = getPortraitStage(state);
  const bgId = event.bg ?? "practice_room";
  const onStage = isStageBg(event.bg);

  const chosen = chosenId ? event.choices.find((c) => c.id === chosenId) : undefined;
  const check = chosen?.check;
  const passed = check && resultText ? resultText.includes(check.success.text) : null;

  return (
    <div
      className={`${onStage ? "stage " : ""}fixed inset-0 z-40 flex justify-center`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="idol-scene-title"
      data-testid="event-scene"
    >
      <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden bg-[var(--bg)]">
        {/* 배경 전면 */}
        {event.cg ? (
          <GameImage
            src={cgSrc(event.cg)}
            alt=""
            className="absolute inset-0 h-full w-full"
            fallback={<span className={`scene ${sceneMotifClass(bgId)}`} />}
          />
        ) : (
          <SceneBg id={bgId} />
        )}
        <div className="scene-scrim" />

        {/* 상반신 — 오른쪽 하단, 높이 60% */}
        <div className="pointer-events-none absolute bottom-[38%] right-0 h-[46%] w-[62%] max-w-[260px]">
          <HeroAvatar stage={stage} emotion={emotion} name={state.idol.name} />
        </div>

        <div className="relative mt-auto flex max-h-[74%] flex-col p-3">
          <div className="glass flex max-h-full flex-col overflow-hidden rounded-[20px] p-3.5">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="on-accent rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-extrabold leading-none">
                {state.idol.name}
              </span>
              <h2 id="idol-scene-title" className="text-[15px] font-extrabold text-[var(--ink)]">
                {event.title}
              </h2>
              {check && resultText ? (
                <Chip tone={passed ? "good" : "bad"}>{passed ? "성공" : "실패"}</Chip>
              ) : null}
            </div>

            <div className="idol-no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <p className="whitespace-pre-line text-[15px] leading-[1.7] text-[var(--ink)]">
                {event.text}
              </p>
              {resultText ? (
                <p className="mt-2.5 whitespace-pre-line border-t border-[var(--line)] pt-2.5 text-[14px] leading-[1.7] text-[var(--accent-ink)]">
                  {resultText}
                </p>
              ) : null}
            </div>

            <div className="mt-3 shrink-0">
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
                        className="min-h-[52px] w-full rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-left transition-colors duration-[120ms] hover:bg-[var(--accent-soft)]"
                      >
                        <span className="block text-[14px] font-bold leading-6 text-[var(--ink)]">
                          {choice.label}
                        </span>
                        {choice.hint ? (
                          <span className="mt-0.5 block text-[11px] text-[var(--accent-ink)]">
                            {choice.hint}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
