"use client";

/**
 * 메인 플레이 — 얇은 렌더러.
 * 게임 규칙은 전부 엔진(@/game/idol/engine)이 계산하고, 이 페이지는 phase 에 따라 패널을 고르고
 * 연출 타이머(주차 로그 공개 → step 호출)만 관리한다.
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
import { clearAuto, loadAuto, loadSettings, recordEnding, saveAuto, saveSettings } from "@/game/idol/save";
import { WEEKS_PER_MONTH } from "@/game/idol/types";
import type {
  ActivityId,
  ComebackFocus,
  ConceptId,
  GameEventDef,
  GameSettings,
  GameState,
} from "@/game/idol/types";
import { ActivityPicker } from "@/components/idol/ActivityPicker";
import { AwardScreen } from "@/components/idol/AwardScreen";
import { ComebackPanel } from "@/components/idol/ComebackPanel";
import { DebutEvalScreen } from "@/components/idol/DebutEvalScreen";
import { DialogueBox } from "@/components/idol/DialogueBox";
import { EndingScreen } from "@/components/idol/EndingScreen";
import { EventModal } from "@/components/idol/EventModal";
import { MonthReport } from "@/components/idol/MonthReport";
import { Portrait } from "@/components/idol/Portrait";
import { ResolveLog } from "@/components/idol/ResolveLog";
import { SaveMenu } from "@/components/idol/SaveMenu";
import { StatPanel } from "@/components/idol/StatPanel";
import { TopBar } from "@/components/idol/TopBar";
import { WeekPlanner } from "@/components/idol/WeekPlanner";
import { Button, Card, ConfirmDialog, SectionTitle } from "@/components/idol/ui";

/** 로그 한 줄이 나타나는 간격 (GDD 12.2 / TECH_SPEC 6.4) */
const SPEED_DELAY: Record<GameSettings["speed"], number> = { normal: 300, fast: 80 };
/** 로그를 다 보여준 뒤 다음 주차를 계산하기까지의 짧은 텀 (한 줄 간격이 SPEED_DELAY 가 되도록) */
const STEP_DELAY = 30;
const TRAINER_MULS: Record<number, string> = { 1: "×1.0", 2: "×1.25", 3: "×1.5" };

type PickerTarget = 0 | 1 | 2 | 3 | "fill";

function clearPlan(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < WEEKS_PER_MONTH; i += 1) {
    next = setPlanSlot(next, i as 0 | 1 | 2 | 3, null);
  }
  return next;
}

export default function IdolPlayPage() {
  const router = useRouter();

  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [speed, setSpeed] = useState<GameSettings["speed"]>("normal");
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [eventView, setEventView] = useState<{ def: GameEventDef; result: string | null } | null>(null);

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

  // --- 이벤트 모달 띄우기 ----------------------------------------------------
  useEffect(() => {
    if (!state || eventView) return;
    if (state.ui.phase !== "event") return;
    if (revealed < state.ui.log.length) return;
    const def = getCurrentEvent(state);
    if (def) setEventView({ def, result: null });
  }, [state, revealed, eventView]);

  // --- 엔딩 기록 -------------------------------------------------------------
  const endingId = state?.ending?.id ?? null;
  useEffect(() => {
    if (!state || !state.ending) return;
    recordEnding(state);
    clearAuto();
    // 엔딩 id 가 정해지는 순간 한 번만 실행한다 (recordEnding 은 같은 id 를 덮어쓰므로 재실행도 안전)
  }, [endingId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const next = picker === "fill" ? fillPlan(state, id) : setPlanSlot(state, picker, id);
      setState(next);
      setPicker(null);
    },
    [picker, state],
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
      setEventView((view) => (view && text ? { ...view, result: text } : null));
    },
    [state],
  );

  const handleLoadSlot = useCallback(
    (loaded: GameState) => {
      setMenuOpen(false);
      setEventView(null);
      stepSigRef.current = "";
      saveAuto(loaded);
      setState(loaded);
      setRevealed(loaded.ui.log.length);
    },
    [],
  );

  // --- 렌더 -----------------------------------------------------------------
  if (!booted || !state) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="idol-pulse text-[13px] text-[#98A2CC]">불러오는 중…</p>
      </main>
    );
  }

  if (state.ending) {
    return (
      <EndingScreen
        ending={getEndingDef(state.ending.id)}
        state={state}
        onTitle={() => router.push("/idol")}
        onGallery={() => router.push("/idol/endings")}
      />
    );
  }

  const phase = state.ui.phase;
  const logsPending = revealed < state.ui.log.length;
  const stage = getPortraitStage(state);
  const emotion = getEmotion(state);

  let panel: ReactNode;

  if (phase === "planning") {
    const preview = getPlanPreview(state);
    const activities = getAvailableActivities(state);
    const debut = canRequestDebutEval(state);
    const upgradeCost = getTrainerUpgradeCost(state);
    const canUpgrade = upgradeCost !== null && state.economy.money >= upgradeCost;

    panel = (
      <section className="flex flex-1 flex-col gap-3" data-testid="planning">
        <div className="flex gap-3">
          <Portrait stage={stage} emotion={emotion} name={state.idol.name} size="md" />
          <StatPanel idol={state.idol} />
        </div>

        <DialogueBox speaker={state.idol.name} text={getIdolLine(state)} />

        <div>
          <SectionTitle right={`트레이너 ${state.economy.trainerTier}등급 ${TRAINER_MULS[state.economy.trainerTier]}`}>
            이번 달 계획
          </SectionTitle>
          <WeekPlanner
            plan={state.ui.plan}
            activities={activities}
            preview={preview}
            onPick={(slot) => setPicker(slot as 0 | 1 | 2 | 3)}
            onFillAll={() => setPicker("fill")}
          />
        </div>

        <Card>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-[12px] font-bold text-[#EEF0FF]">트레이너 등급</p>
              <p className="text-[11px] text-[#98A2CC]">
                {upgradeCost === null
                  ? "최고 등급이다. 더 올릴 곳이 없다."
                  : `${state.economy.trainerTier + 1}등급으로 올리면 훈련 효과 ${
                      TRAINER_MULS[state.economy.trainerTier + 1]
                    }, 레슨비가 조금 오른다.`}
              </p>
            </div>
            <Button
              small
              variant="secondary"
              disabled={!canUpgrade}
              onClick={() => setConfirmUpgrade(true)}
              testId="upgrade-trainer"
            >
              {upgradeCost === null ? "최대" : `${upgradeCost}만`}
            </Button>
          </div>
        </Card>

        {state.career.debuted ? null : (
          <Card>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-[12px] font-bold text-[#EEF0FF]">데뷔 평가 신청</p>
                <p className="text-[11px] text-[#98A2CC]">
                  {debut.ok
                    ? "이번 달 계획과 별개로 즉시 심사받는다. 신청만으로 스트레스가 오른다."
                    : (debut.reason ?? "지금은 신청할 수 없다")}
                </p>
              </div>
              <Button
                small
                variant={debut.ok ? "primary" : "secondary"}
                disabled={!debut.ok}
                // 결과가 확정되는 조작이므로 즉시 자동 저장한다 (새로고침으로 재추첨 불가)
                onClick={() => apply(requestDebutEval(state), { save: true })}
                testId="request-debut"
              >
                신청
              </Button>
            </div>
          </Card>
        )}

        <div className="mt-auto pt-1">
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
            한 달 진행
          </Button>
        </div>
      </section>
    );
  } else if (phase === "debut_eval" && state.ui.lastDebutEval) {
    panel = (
      <DebutEvalScreen
        result={state.ui.lastDebutEval}
        name={state.idol.name}
        stage={stage}
        onConfirm={() => apply(confirmDebutEval(state), { save: true })}
      />
    );
  } else if (phase === "comeback") {
    panel = (
      <ComebackPanel
        state={state}
        onChoose={(concept: ConceptId, focus: ComebackFocus) =>
          apply(chooseComeback(state, concept, focus), { save: true })
        }
        onConfirm={() => apply(confirmComeback(state), { save: true })}
      />
    );
  } else if (phase === "award") {
    panel = (
      <AwardScreen
        awards={state.ui.lastAwards}
        month={state.month}
        onConfirm={() => apply(confirmAward(state), { save: true })}
      />
    );
  } else if (phase === "report" && !logsPending && state.ui.report) {
    panel = (
      <MonthReport
        report={state.ui.report}
        name={state.idol.name}
        stage={stage}
        onNext={() => apply(confirmReport(state), { save: true })}
      />
    );
  } else {
    panel = (
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex gap-3">
          <Portrait stage={stage} emotion={emotion} name={state.idol.name} size="sm" />
          <StatPanel idol={state.idol} compact />
        </div>
        <ResolveLog
          log={state.ui.log}
          visibleCount={revealed}
          weekIndex={state.ui.weekIndex}
          speed={speed}
          onToggleSpeed={handleToggleSpeed}
          done={phase !== "resolving" && !logsPending}
        />
      </div>
    );
  }

  const pickerState = picker === "fill" ? clearPlan(state) : null;
  const pickerList =
    picker === null
      ? []
      : picker === "fill"
        ? getAvailableActivities(pickerState ?? state)
        : getAvailableActivities(setPlanSlot(state, picker, null));

  return (
    <>
      <TopBar state={state} onOpenMenu={() => setMenuOpen(true)} />
      <main className="flex flex-1 flex-col px-3 pb-5 pt-3">{panel}</main>

      {picker !== null ? (
        <ActivityPicker
          list={pickerList}
          title={picker === "fill" ? "4주 모두 채울 활동" : `${(picker as number) + 1}주차 활동 선택`}
          currentId={picker === "fill" ? null : state.ui.plan[picker]}
          onSelect={handlePickActivity}
          onClear={
            picker === "fill"
              ? undefined
              : () => {
                  setState(setPlanSlot(state, picker, null));
                  setPicker(null);
                }
          }
          onClose={() => setPicker(null)}
        />
      ) : null}

      {eventView ? (
        <EventModal
          event={eventView.def}
          state={state}
          resultText={eventView.result}
          onChoose={handleEventChoice}
          onConfirmResult={() => setEventView(null)}
        />
      ) : null}

      {menuOpen ? (
        <SaveMenu
          state={state}
          speed={speed}
          onSpeedChange={handleSpeed}
          onLoad={handleLoadSlot}
          onClose={() => setMenuOpen(false)}
          onExitToTitle={() => router.push("/idol")}
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
    </>
  );
}
