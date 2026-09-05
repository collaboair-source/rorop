"use client";

/**
 * 메인 플레이 — 얇은 렌더러.
 * 게임 규칙은 전부 엔진(@/game/idol/engine)이 계산하고, 이 페이지는 phase 에 따라 화면을 고르고
 * 연출 타이머(주차 로그 공개 → step 호출)만 관리한다. v1 에서 검증된 엔진 연결 로직을 그대로 옮겼다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  canRequestDebutEval,
  chooseComeback,
  chooseOption,
  confirmAward,
  confirmComeback,
  confirmDebutEval,
  confirmReport,
  fillPlan,
  formatFans,
  getAvailableActivities,
  getCurrentEvent,
  getEmotion,
  getEndingDef,
  getIdolLine,
  getPlanPreview,
  getPortraitStage,
  getTrainerUpgradeCost,
  requestDebutEval,
  setPlanSlot,
  startMonth,
  step,
  upgradeTrainer,
} from "@/game/idol/engine";
import {
  clearAuto,
  loadAuto,
  loadSettings,
  recordEnding,
  saveAuto,
  saveSettings,
  unlockCards,
} from "@/game/idol/save";
import { CAREER_PHASE_LABELS, SKILL_IDS, WEEKS_PER_MONTH } from "@/game/idol/types";
import type {
  ActivityId,
  BackgroundImageId,
  CareerPhase,
  ComebackFocus,
  ConceptId,
  GameEventDef,
  GameSettings,
  GameState,
} from "@/game/idol/types";
import { ActivitySheet } from "@/components/idol/ActivitySheet";
import { AwardStage } from "@/components/idol/AwardStage";
import { ComebackStage } from "@/components/idol/ComebackStage";
import { DebutEvalStage } from "@/components/idol/DebutEvalStage";
import { EndingStage } from "@/components/idol/EndingStage";
import { HeroScene } from "@/components/idol/HeroScene";
import { PlanStrip } from "@/components/idol/PlanStrip";
import { RadarChart } from "@/components/idol/RadarChart";
import { ReportView } from "@/components/idol/ReportView";
import { RingGauge } from "@/components/idol/RingGauge";
import { SaveSheet } from "@/components/idol/SaveSheet";
import { SceneView } from "@/components/idol/SceneView";
import { StatSheet } from "@/components/idol/StatSheet";
import { Toast } from "@/components/idol/Toast";
import { WeekTimeline } from "@/components/idol/WeekTimeline";
import { Button, Chip, ConfirmDialog, Icon } from "@/components/idol/ui";
import { collectUnlocks, endingCardId, getCard, type CardDef } from "@/components/idol/album";
import { bubbleTime, monthLabel, moneyText } from "@/components/idol/format";

/** 로그 한 줄이 나타나는 간격 (GDD 12.2 / TECH_SPEC 6.4) */
const SPEED_DELAY: Record<GameSettings["speed"], number> = { normal: 300, fast: 80 };
/** 로그를 다 보여준 뒤 다음 주차를 계산하기까지의 짧은 텀 */
const STEP_DELAY = 30;
const TRAINER_MULS: Record<number, string> = { 1: "×1.0", 2: "×1.25", 3: "×1.5" };

/** 페이즈별 장면 배경 (04 문서 3.3) */
const PHASE_SCENE: Record<CareerPhase, BackgroundImageId> = {
  trainee: "practice_room",
  rookie: "office",
  rising: "recording_studio",
  star: "concert_arena",
};

const STRESS_WARN_LINE = 70;

function clearPlan(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < WEEKS_PER_MONTH; i += 1) {
    next = setPlanSlot(next, i as 0 | 1 | 2 | 3, null);
  }
  return next;
}

function toCards(ids: string[]): CardDef[] {
  const out: CardDef[] = [];
  for (const id of ids) {
    const card = getCard(id);
    if (card) out.push(card);
  }
  return out;
}

export default function IdolPlayPage() {
  const router = useRouter();

  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [speed, setSpeed] = useState<GameSettings["speed"]>("normal");
  const [picker, setPicker] = useState<0 | 1 | 2 | 3 | null>(null);
  const [applyAll, setApplyAll] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statOpen, setStatOpen] = useState(false);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [eventView, setEventView] = useState<{
    def: GameEventDef;
    result: string | null;
    choiceId: string | null;
  } | null>(null);

  // 포토카드
  const [toasts, setToasts] = useState<CardDef[]>([]);
  const [monthCards, setMonthCards] = useState<string[]>([]);
  const [screenCards, setScreenCards] = useState<string[]>([]);

  const stepSigRef = useRef("");
  const delay = SPEED_DELAY[speed];

  // --- 부팅 (자동 저장이 없으면 타이틀로) -----------------------------------
  useEffect(() => {
    setSpeed(loadSettings().speed);
    const auto = loadAuto();
    if (!auto) {
      router.replace("/idol");
      return;
    }
    setState(auto);
    setRevealed(auto.ui.log.length);
    setBooted(true);
  }, [router]);

  // --- 로그 한 줄씩 공개 -----------------------------------------------------
  useEffect(() => {
    if (!state) return;
    const total = state.ui.log.length;
    if (revealed >= total) return;
    const id = window.setTimeout(() => setRevealed((r) => Math.min(r + 1, total)), delay);
    return () => window.clearTimeout(id);
  }, [state, revealed, delay]);

  // --- 주차 진행 (로그를 다 보여준 뒤 다음 step) ------------------------------
  useEffect(() => {
    if (!state || eventView) return;
    if (state.ui.phase !== "resolving") return;
    if (revealed < state.ui.log.length) return;
    const sig = `${state.month}|${state.ui.weekIndex}|${state.ui.log.length}`;
    if (stepSigRef.current === sig) return;
    const id = window.setTimeout(() => {
      stepSigRef.current = sig;
      setState((prev) => (prev && prev.ui.phase === "resolving" ? step(prev) : prev));
    }, STEP_DELAY);
    return () => window.clearTimeout(id);
  }, [state, revealed, eventView]);

  // --- 이벤트 장면 띄우기 ----------------------------------------------------
  useEffect(() => {
    if (!state || eventView) return;
    if (state.ui.phase !== "event") return;
    if (revealed < state.ui.log.length) return;
    const def = getCurrentEvent(state);
    if (def) setEventView({ def, result: null, choiceId: null });
  }, [state, revealed, eventView]);

  // --- 엔딩 기록 -------------------------------------------------------------
  const endingId = state?.ending?.id ?? null;
  useEffect(() => {
    if (!state || !state.ending) return;
    recordEnding(state);
    clearAuto();
    // 엔딩 id 가 정해지는 순간 한 번만 실행한다 (recordEnding 은 같은 id 를 덮어쓰므로 재실행도 안전)
  }, [endingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- 포토카드 획득 ---------------------------------------------------------
  useEffect(() => {
    if (!state) return;
    const phase = state.ui.phase;
    const emotion =
      phase === "report" && state.ui.report ? state.ui.report.emotion : getEmotion(state);
    const ids = collectUnlocks(state, {
      stage: getPortraitStage(state),
      emotion,
      event: eventView?.def ?? null,
    });
    const gained = unlockCards(ids);
    if (gained.length === 0) return;
    setMonthCards((prev) => [...prev, ...gained]);
    // 리포트·무대 화면에서는 토스트 대신 화면 안에서 보여준다 (04 문서 2.2)
    const inline =
      phase === "report" || phase === "ended" || phase === "debut_eval" || phase === "comeback" ||
      phase === "award" || state.ending !== null;
    if (inline) setScreenCards((prev) => [...prev, ...gained]);
    else setToasts((prev) => [...prev, ...toCards(gained)]);
  }, [state, eventView]);

  // --- 액션 -----------------------------------------------------------------
  const apply = useCallback((next: GameState, options?: { save?: boolean; resetLog?: boolean }) => {
    setState(next);
    setRevealed(options?.resetLog ? 0 : next.ui.log.length);
    if (options?.save) saveAuto(next);
  }, []);

  const handleSpeed = useCallback((next: GameSettings["speed"]) => {
    setSpeed(next);
    saveSettings({ speed: next });
  }, []);

  const handleToggleSpeed = useCallback(() => {
    handleSpeed(speed === "fast" ? "normal" : "fast");
  }, [handleSpeed, speed]);

  const handlePickActivity = useCallback(
    (id: ActivityId) => {
      if (!state || picker === null) return;
      const next = applyAll ? fillPlan(state, id) : setPlanSlot(state, picker, id);
      setState(next);
      setPicker(null);
      setApplyAll(false);
    },
    [applyAll, picker, state],
  );

  const handleEventChoice = useCallback(
    (choiceId: string) => {
      if (!state) return;
      const next = chooseOption(state, choiceId);
      if (next === state) return;
      setState(next);
      setRevealed(next.ui.log.length);
      saveAuto(next);
      const text = next.ui.lastChoiceText;
      setEventView((view) => (view && text ? { ...view, result: text, choiceId } : null));
    },
    [state],
  );

  const handleLoadSlot = useCallback((loaded: GameState) => {
    setMenuOpen(false);
    setEventView(null);
    stepSigRef.current = "";
    saveAuto(loaded);
    setState(loaded);
    setRevealed(loaded.ui.log.length);
    setMonthCards([]);
    setScreenCards([]);
  }, []);

  // --- 렌더 -----------------------------------------------------------------
  if (!booted || !state) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="idol-pulse text-[13px] text-[var(--ink-3)]">불러오는 중…</p>
      </main>
    );
  }

  // 이벤트 장면이 떠 있는 동안에는 토스트를 미뤄 둔다 (선택지를 가리지 않게)
  const toastCard = eventView ? null : (toasts[0] ?? null);
  const toastNode = toastCard ? (
    <Toast card={toastCard} onDone={() => setToasts((q) => q.slice(1))} />
  ) : null;

  if (state.ending) {
    const card = getCard(endingCardId(state.ending.id));
    return (
      <>
        <EndingStage
          ending={getEndingDef(state.ending.id)}
          state={state}
          card={card}
          onTitle={() => router.push("/idol")}
          onAlbum={() => router.push("/idol/album?tab=ending")}
        />
        {toastNode}
      </>
    );
  }

  const phase = state.ui.phase;
  const logsPending = revealed < state.ui.log.length;
  const stage = getPortraitStage(state);
  const emotion = getEmotion(state);
  const screenCardDefs = toCards(screenCards);

  // --- 온스테이지 화면 (자체 .stage 루트) ------------------------------------
  if (phase === "debut_eval" && state.ui.lastDebutEval) {
    return (
      <>
        <DebutEvalStage
          result={state.ui.lastDebutEval}
          newCards={screenCardDefs}
          onConfirm={() => {
            setScreenCards([]);
            apply(confirmDebutEval(state), { save: true });
          }}
        />
        {toastNode}
      </>
    );
  }

  if (phase === "comeback") {
    return (
      <>
        <ComebackStage
          state={state}
          newCards={screenCardDefs}
          onChoose={(concept: ConceptId, focus: ComebackFocus) =>
            apply(chooseComeback(state, concept, focus), { save: true })
          }
          onConfirm={() => {
            setScreenCards([]);
            apply(confirmComeback(state), { save: true });
          }}
        />
        {toastNode}
      </>
    );
  }

  if (phase === "award") {
    return (
      <>
        <AwardStage
          awards={state.ui.lastAwards}
          month={state.month}
          newCards={screenCardDefs}
          onConfirm={() => {
            setScreenCards([]);
            apply(confirmAward(state), { save: true });
          }}
        />
        {toastNode}
      </>
    );
  }

  // --- 백스테이지 화면 -------------------------------------------------------
  const sceneBg = PHASE_SCENE[state.career.phase];
  const condition = state.idol.condition;

  let panel: ReactNode;

  if (phase === "report" && !logsPending && state.ui.report) {
    panel = (
      <ReportView
        report={state.ui.report}
        name={state.idol.name}
        stage={stage}
        monthCards={toCards(monthCards)}
        onNext={() => {
          setMonthCards([]);
          setScreenCards([]);
          apply(confirmReport(state), { save: true });
        }}
      />
    );
  } else if (phase === "planning") {
    const preview = getPlanPreview(state);
    const activities = getAvailableActivities(state);
    const debut = canRequestDebutEval(state);
    const upgradeCost = getTrainerUpgradeCost(state);
    const canUpgrade = upgradeCost !== null && state.economy.money >= upgradeCost;

    panel = (
      <section className="flex flex-1 flex-col" data-testid="planning">
        <HeroScene
          bg={sceneBg}
          stage={stage}
          emotion={emotion}
          name={state.idol.name}
          line={getIdolLine(state)}
          time={bubbleTime(state.month)}
          height={360}
        />

        <div className="relative z-10 -mt-6 px-4">
          <button
            type="button"
            onClick={() => setStatOpen(true)}
            data-testid="open-stats"
            className="glass flex w-full items-center gap-3 rounded-[20px] p-3 text-left"
          >
            <RadarChart values={SKILL_IDS.map((id) => state.idol.skills[id])} size={110} />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <RingGauge
                value={condition.stamina}
                max={condition.maxStamina}
                color="var(--good)"
                label="체력"
              />
              <RingGauge
                value={condition.stress}
                color={condition.stress >= STRESS_WARN_LINE ? "var(--bad)" : "var(--warn)"}
                label="스트레스"
              />
              <RingGauge value={state.idol.social.bond} color="var(--accent)" label="호감도" />
            </span>
          </button>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="accent">평판 {Math.round(state.idol.social.reputation)}</Chip>
            <Chip>트레이너 ★{state.economy.trainerTier}</Chip>
            {condition.injured ? <Chip tone="bad">부상 중</Chip> : null}
          </div>
        </div>

        <div className="mt-4 px-4">
          <PlanStrip
            plan={state.ui.plan}
            activities={activities}
            preview={preview}
            onPick={(slot) => {
              setApplyAll(false);
              setPicker(slot as 0 | 1 | 2 | 3);
            }}
            onFillAll={() => {
              setApplyAll(true);
              setPicker(0);
            }}
          />
        </div>

        <div className="mt-5 px-4 pb-6">
          <Button
            full
            variant="primary"
            disabled={!preview.valid}
            onClick={() => {
              const next = startMonth(state);
              if (next !== state) apply(next, { resetLog: true });
            }}
            testId="start-month"
          >
            이번 달 진행
            <Icon name="play" size={16} />
          </Button>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
            {state.career.debuted ? null : (
              <>
                <button
                  type="button"
                  disabled={!debut.ok}
                  onClick={() => apply(requestDebutEval(state), { save: true })}
                  data-testid="request-debut"
                  title={debut.ok ? undefined : (debut.reason ?? "지금은 신청할 수 없다")}
                  className="min-h-[44px] px-2 text-[13px] font-bold text-[var(--accent-ink)] disabled:text-[var(--ink-3)]"
                >
                  데뷔 평가 신청
                </button>
                <span className="text-[var(--line)]">·</span>
              </>
            )}
            <button
              type="button"
              disabled={!canUpgrade}
              onClick={() => setConfirmUpgrade(true)}
              data-testid="upgrade-trainer"
              title={
                upgradeCost === null
                  ? "최고 등급이다"
                  : `${upgradeCost}만원으로 ${TRAINER_MULS[state.economy.trainerTier + 1]}`
              }
              className="min-h-[44px] px-2 text-[13px] font-bold text-[var(--accent-ink)] disabled:text-[var(--ink-3)]"
            >
              트레이너 ★{state.economy.trainerTier}
              {upgradeCost === null ? " 최대" : ` → ${upgradeCost}만`}
            </button>
            <span className="text-[var(--line)]">·</span>
            <button
              type="button"
              onClick={() => router.push("/idol/album")}
              data-testid="open-album"
              className="min-h-[44px] px-2 text-[13px] font-bold text-[var(--accent-ink)]"
            >
              앨범
            </button>
          </div>

          {state.career.debuted || debut.ok ? null : (
            <p className="mt-1 text-center text-[11px] leading-5 text-[var(--ink-3)]">
              {debut.reason ?? "지금은 데뷔 평가를 신청할 수 없다"}
            </p>
          )}
        </div>
      </section>
    );
  } else {
    panel = (
      <section className="flex flex-1 flex-col" data-testid="resolving">
        <HeroScene
          bg={sceneBg}
          stage={stage}
          emotion={emotion}
          name={state.idol.name}
          height={240}
          scrim
        />
        <div className="px-4 pb-6 pt-3">
          <WeekTimeline
            log={state.ui.log}
            visibleCount={revealed}
            weekIndex={state.ui.weekIndex}
            plan={state.ui.plan}
            speed={speed}
            onToggleSpeed={handleToggleSpeed}
            done={phase !== "resolving" && !logsPending}
          />
        </div>
      </section>
    );
  }

  const pickerList =
    picker === null
      ? []
      : applyAll
        ? getAvailableActivities(clearPlan(state))
        : getAvailableActivities(setPlanSlot(state, picker, null));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-2 backdrop-blur">
        <div className="flex min-h-[44px] items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold text-[var(--ink)]" data-testid="month-label">
              {monthLabel(state.month)}{" "}
              <span className="text-[12px] font-bold text-[var(--ink-3)]">
                · {CAREER_PHASE_LABELS[state.career.phase]}
              </span>
            </p>
            <p className="num flex items-center gap-3 text-[12px] text-[var(--ink-2)]">
              <span>
                <span aria-hidden="true">💰</span> {moneyText(state.economy.money)}
              </span>
              <span data-testid="fans">
                <span aria-hidden="true">👥</span> {formatFans(state.idol.social.fans)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            data-testid="open-menu"
            aria-label="메뉴"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--surface-2)]"
          >
            <Icon name="menu" size={22} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{panel}</main>

      {picker !== null ? (
        <ActivitySheet
          list={pickerList}
          title={applyAll ? "4주 모두 채울 활동" : `${picker + 1}주차 활동`}
          subtitle={applyAll ? "고른 활동으로 네 주를 모두 채운다" : undefined}
          currentId={applyAll ? null : state.ui.plan[picker]}
          applyAll={applyAll}
          onToggleApplyAll={() => setApplyAll((v) => !v)}
          onSelect={handlePickActivity}
          onClear={
            applyAll || !state.ui.plan[picker]
              ? undefined
              : () => {
                  setState(setPlanSlot(state, picker, null));
                  setPicker(null);
                }
          }
          onClose={() => {
            setPicker(null);
            setApplyAll(false);
          }}
        />
      ) : null}

      {statOpen ? <StatSheet idol={state.idol} onClose={() => setStatOpen(false)} /> : null}

      {eventView ? (
        <SceneView
          event={eventView.def}
          state={state}
          resultText={eventView.result}
          chosenId={eventView.choiceId}
          onChoose={handleEventChoice}
          onConfirmResult={() => setEventView(null)}
        />
      ) : null}

      {menuOpen ? (
        <SaveSheet
          state={state}
          speed={speed}
          onSpeedChange={handleSpeed}
          onLoad={handleLoadSlot}
          onClose={() => setMenuOpen(false)}
          onExitToTitle={() => router.push("/idol")}
          onAlbum={() => router.push("/idol/album")}
        />
      ) : null}

      {confirmUpgrade ? (
        <ConfirmDialog
          title="트레이너 업그레이드"
          message={`${getTrainerUpgradeCost(state) ?? 0}만원을 지불하고 ${
            state.economy.trainerTier + 1
          }등급 트레이너로 바꾼다. 되돌릴 수 없다.`}
          confirmLabel="업그레이드"
          onConfirm={() => {
            setConfirmUpgrade(false);
            apply(upgradeTrainer(state), { save: true });
          }}
          onCancel={() => setConfirmUpgrade(false)}
        />
      ) : null}

      {toastNode}
    </>
  );
}
