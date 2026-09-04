/** 월말 처리 — 고정 정산(GDD 7.1), 팬 자연 변동(7.2), 각종 카운터, 리포트 작성 */

import * as B from "../balance";
import { getActivity } from "../data/activities";
import { WEEKS_PER_MONTH, type ActivityId, type GameState, type MonthReport, type MonthSummary } from "../types";
import { updatePhase } from "./career";
import { markEventFired, rollMonthEndEvent } from "./events";
import { addFans, addMoney, addStamina, formatFans, setInjured, snapshotOf } from "./resolve";
import { getEmotion, getIdolLine } from "./selectors";

export interface Ledger {
  entries: Array<{ label: string; amount: number }>;
  notices: string[];
}

function hasPromoThisMonth(state: GameState): boolean {
  return state.ui.plan.some((slot: ActivityId | null) => slot !== null && getActivity(slot).category === "promo");
}

/** 고정 정산 + 팬 자연 변동 + 카운터. draft 를 직접 변경한다. */
export function settleMonth(draft: GameState): Ledger {
  const entries: Array<{ label: string; amount: number }> = [];
  const notices: string[] = [];

  // 회사 지원금 (연습생만)
  if (!draft.career.debuted) {
    const cut = draft.economy.supportCutMonthsLeft > 0;
    const support = cut ? B.MONTHLY_SUPPORT_CUT : B.MONTHLY_SUPPORT;
    addMoney(draft, support);
    entries.push({ label: cut ? "회사 지원금 (삭감)" : "회사 지원금", amount: support });
  }

  // 숙소비
  addMoney(draft, -B.MONTHLY_DORM_COST);
  entries.push({ label: "숙소비", amount: -B.MONTHLY_DORM_COST });

  // 팬 수익 (데뷔 후)
  if (draft.career.debuted) {
    const revenue = Math.min(
      B.FAN_REVENUE_CAP,
      Math.floor(draft.idol.social.fans / B.FAN_REVENUE_UNIT) * B.FAN_REVENUE_PER_UNIT,
    );
    if (revenue > 0) {
      addMoney(draft, revenue);
      entries.push({ label: "팬 수익", amount: revenue });
    }
  }

  // 예능 고정 출연 (E22)
  const varietyUntil = draft.flags.variety_regular_until;
  if (typeof varietyUntil === "number" && varietyUntil >= draft.month) {
    addMoney(draft, B.VARIETY_REGULAR_MONEY);
    entries.push({ label: "예능 고정 출연료", amount: B.VARIETY_REGULAR_MONEY });
    addFans(draft, Math.round(draft.idol.social.fans * B.VARIETY_REGULAR_FANS_PCT));
    addStamina(draft, B.VARIETY_REGULAR_STAMINA);
    if (varietyUntil === draft.month) notices.push("예능 고정 출연 계약이 이번 달로 끝났다");
  }

  // 가불 상환
  if (draft.economy.debtMonthsLeft > 0) {
    addMoney(draft, -B.DEBT_MONTHLY_REPAY);
    entries.push({ label: "가불 상환", amount: -B.DEBT_MONTHLY_REPAY });
    draft.economy.debtMonthsLeft -= 1;
    if (draft.economy.debtMonthsLeft === 0) notices.push("가불 상환이 모두 끝났다");
  }

  // 팬 자연 변동 (데뷔 후만)
  if (draft.career.debuted) {
    const pct = hasPromoThisMonth(draft) ? B.PROMO_FANS_PCT : B.NO_PROMO_FANS_PCT;
    const delta = Math.round(draft.idol.social.fans * pct);
    addFans(draft, delta);
    if (pct < 0) {
      notices.push(`홍보 활동이 없어 팬이 ${formatFans(Math.abs(delta))} 줄었다`);
    }
  }

  // 지원 삭감 카운터
  if (draft.economy.supportCutMonthsLeft > 0) {
    draft.economy.supportCutMonthsLeft -= 1;
    if (draft.economy.supportCutMonthsLeft === 0) notices.push("회사 지원금이 원래대로 돌아왔다");
  }

  // 부상 자연 회복
  if (draft.idol.condition.injured) {
    draft.idol.condition.injuredMonthsLeft -= 1;
    if (draft.idol.condition.injuredMonthsLeft <= 0) {
      setInjured(draft, false);
      notices.push("부상이 자연 회복됐다");
    } else {
      notices.push(`부상 회복까지 ${draft.idol.condition.injuredMonthsLeft}개월 남았다`);
    }
  }

  // 페이즈 갱신
  const phaseNotice = updatePhase(draft);
  if (phaseNotice) notices.push(phaseNotice);

  // 생활고(E33) 트리거 플래그
  if (!draft.career.debuted && draft.economy.money < B.MONEY_CRISIS_THRESHOLD) {
    draft.flags.low_money = true;
  } else {
    draft.flags.low_money = false;
  }

  return { entries, notices };
}

/** 리포트를 완성하고 phase 를 'report' 로 만든다 */
export function completeMonthEnd(draft: GameState): void {
  const scratch = draft.ui.report;
  const before = scratch ? scratch.before : snapshotOf(draft);
  const ledgerEntries = scratch ? scratch.ledger : [];
  const notices = scratch ? scratch.notices : [];

  const report: MonthReport = {
    month: draft.month,
    before,
    after: snapshotOf(draft),
    ledger: ledgerEntries,
    idolLine: "",
    emotion: "neutral",
    notices,
  };
  draft.ui.report = report;
  report.idolLine = getIdolLine(draft);
  report.emotion = getEmotion(draft);

  const summary: MonthSummary = { month: draft.month, ...report.after };
  draft.history.push(summary);

  draft.flags.low_money = false;
  draft.flags.just_debuted = false;
  draft.ui.pendingMonthEnd = false;
  draft.ui.phase = "report";
}

/**
 * 4주차까지 끝난 뒤의 월말 처리.
 * 월말 이벤트(E33)가 발생하면 phase 'event' 로 두고 pendingMonthEnd 를 세운다.
 */
export function finishMonth(draft: GameState): void {
  draft.ui.weekIndex = WEEKS_PER_MONTH;
  const ledger = settleMonth(draft);
  if (draft.ui.report) {
    draft.ui.report.ledger = ledger.entries;
    draft.ui.report.notices = ledger.notices;
  } else {
    draft.ui.report = {
      month: draft.month,
      before: snapshotOf(draft),
      after: snapshotOf(draft),
      ledger: ledger.entries,
      idolLine: "",
      emotion: "neutral",
      notices: ledger.notices,
    };
  }

  const monthEndEvent = rollMonthEndEvent(draft);
  if (monthEndEvent) {
    markEventFired(draft, monthEndEvent);
    draft.ui.pendingEventId = monthEndEvent.id;
    draft.ui.pendingMonthEnd = true;
    draft.ui.phase = "event";
    return;
  }
  completeMonthEnd(draft);
}

/** 다음 달로 넘어가며 월 단위 UI 상태를 초기화한다 */
export function advanceToNextMonth(draft: GameState): void {
  draft.month += 1;
  draft.ui.plan = new Array<ActivityId | null>(WEEKS_PER_MONTH).fill(null);
  draft.ui.weekIndex = 0;
  draft.ui.log = [];
  draft.ui.eventsThisMonth = 0;
  draft.ui.pendingEventId = null;
  draft.ui.lastChoiceText = null;
  draft.ui.pendingMonthEnd = false;
  draft.ui.report = null;
  draft.ui.lastAwards = [];
}
