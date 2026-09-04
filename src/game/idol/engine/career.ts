/** 커리어 — 데뷔 평가(GDD 8.2), 컴백(8.3), 연말 시상식(8.4) */

import * as B from "../balance";
import { getConcept } from "../data/concepts";
import {
  CAREER_PHASE_LABELS,
  TOTAL_MONTHS,
  type AwardId,
  type AwardRecord,
  type ComebackFocus,
  type ComebackRecord,
  type ConceptId,
  type DebutEvalResult,
  type GameState,
} from "../types";
import {
  addBond,
  addFans,
  addMoney,
  addReputation,
  addStress,
  coreAverageOf,
  drawRange,
  formatFans,
  phaseOf,
  round1,
} from "./resolve";

// ---------------------------------------------------------------------------
// 페이즈
// ---------------------------------------------------------------------------

/** 페이즈를 갱신하고, 바뀌었으면 공지 문구를 반환한다 */
export function updatePhase(draft: GameState): string | null {
  const next = phaseOf(draft.career.debuted, draft.idol.social.fans);
  if (next === draft.career.phase) return null;
  draft.career.phase = next;
  return `커리어 단계가 ${CAREER_PHASE_LABELS[next]}(으)로 올라갔다`;
}

// ---------------------------------------------------------------------------
// 데뷔 평가
// ---------------------------------------------------------------------------

export function canRequestDebutEval(state: GameState): { ok: boolean; reason?: string } {
  if (state.career.debuted) return { ok: false, reason: "이미 데뷔했다" };
  if (state.ui.phase !== "planning") return { ok: false, reason: "지금은 신청할 수 없다" };
  if (state.month < B.DEBUT_MIN_MONTH) {
    return { ok: false, reason: `${B.DEBUT_MIN_MONTH}개월차부터 신청할 수 있다` };
  }
  const avg = coreAverageOf(state.idol.skills);
  if (avg < B.DEBUT_MIN_CORE_AVG) {
    return {
      ok: false,
      reason: `코어 5종 평균 ${B.DEBUT_MIN_CORE_AVG} 이상 필요 (현재 ${avg.toFixed(1)})`,
    };
  }
  if (state.idol.social.fans < B.DEBUT_MIN_FANS) {
    return {
      ok: false,
      reason: `팬 ${B.DEBUT_MIN_FANS.toLocaleString("ko-KR")}명 이상 필요 (현재 ${state.idol.social.fans.toLocaleString("ko-KR")}명)`,
    };
  }
  const last = state.career.lastDebutEvalMonth;
  if (last !== null && state.month - last < B.DEBUT_RETRY_MONTHS) {
    return { ok: false, reason: `재신청은 ${last + B.DEBUT_RETRY_MONTHS}개월차부터 가능하다` };
  }
  return { ok: true };
}

function debutEvalText(score: number, passed: boolean): string {
  if (passed) {
    if (score >= 70) {
      return "심사가 끝나기도 전에 대표가 자리에서 일어났다. 데뷔 날짜가 그 자리에서 정해졌다.";
    }
    if (score >= 60) {
      return "무대를 내려오자 박수가 먼저 나왔다. 통과였다.";
    }
    return "합격선을 겨우 넘겼다. 대표는 준비할 게 많다는 말을 세 번 반복했다.";
  }
  if (score >= 45) {
    return "몇 점 차이로 미끄러졌다. 하람은 점수표를 오래 들여다봤다.";
  }
  if (score >= 35) {
    return "아직 무대에 세울 수 없다는 결론이었다. 이유도 분명했다.";
  }
  return "평가는 오 분 만에 끝났다. 하람은 아무 말도 하지 않고 연습실로 돌아갔다.";
}

/** 데뷔 평가를 실행하고 결과를 반환한다 (draft 를 직접 변경) */
export function applyDebutEval(draft: GameState): DebutEvalResult {
  const avg = coreAverageOf(draft.idol.skills);
  const visualBonus = (draft.idol.skills.visual - B.DEBUT_VISUAL_BASE) * B.DEBUT_VISUAL_WEIGHT;
  const fansBonus = Math.min(B.DEBUT_FANS_CAP, draft.idol.social.fans / B.DEBUT_FANS_DIVISOR);
  const noise = drawRange(draft, -B.DEBUT_SCORE_RNG, B.DEBUT_SCORE_RNG);
  const score = round1(avg + visualBonus + fansBonus + noise);
  const passed = score >= B.DEBUT_PASS_SCORE;

  addStress(draft, B.DEBUT_REQUEST_STRESS);
  draft.career.lastDebutEvalMonth = draft.month;

  if (passed) {
    const fansGain = Math.round(B.DEBUT_SHOWCASE_FANS_BASE + score * B.DEBUT_SHOWCASE_FANS_PER_SCORE);
    addFans(draft, fansGain);
    addReputation(draft, B.DEBUT_SHOWCASE_REPUTATION);
    draft.career.debuted = true;
    draft.career.debutMonth = draft.month;
    draft.career.nextComebackMonth = Math.min(TOTAL_MONTHS, draft.month + B.COMEBACK_INTERVAL);
    draft.flags.just_debuted = true;
    draft.flags.cg_debut_showcase = true;
    updatePhase(draft);
  } else {
    addStress(draft, B.DEBUT_FAIL_STRESS);
    addBond(draft, B.DEBUT_FAIL_BOND);
    draft.career.debutEvalFailures += 1;
  }

  const result: DebutEvalResult = {
    month: draft.month,
    score,
    passed,
    text: debutEvalText(score, passed),
  };
  draft.ui.lastDebutEval = result;
  return result;
}

// ---------------------------------------------------------------------------
// 컴백
// ---------------------------------------------------------------------------

function affinityHint(affinity: number): string {
  if (affinity >= B.AFFINITY_GOOD) return "이 콘셉트, 하람에게 정말 잘 어울렸다.";
  if (affinity <= B.AFFINITY_BAD) return "어딘가 어색하다는 반응이 적지 않았다.";
  return "무난하게 소화했다는 평이 많았다.";
}

function comebackHeadline(rank: ComebackRecord["rank"], conceptLabel: string): string {
  switch (rank) {
    case "top1":
      return `${conceptLabel} 콘셉트의 타이틀곡이 음원 차트 1위에 올랐다. 음악방송 1위 트로피도 함께 왔다.`;
    case "top10":
      return `${conceptLabel} 콘셉트는 통했다. 타이틀곡이 차트 10위권에 안착했다.`;
    case "top50":
      return `${conceptLabel} 콘셉트로 차트 50위권에 이름을 올렸다. 나쁘지 않은 성적이다.`;
    default:
      return `${conceptLabel} 콘셉트는 끝내 차트에 들어가지 못했다.`;
  }
}

/** 컴백 결과를 계산·적용하고 기록을 반환한다 (draft 를 직접 변경) */
export function applyComeback(
  draft: GameState,
  concept: ConceptId,
  focus: ComebackFocus,
): ComebackRecord {
  const skills = draft.idol.skills;
  const affinity = draft.idol.conceptAffinity[concept];
  const fansTerm = Math.min(
    B.COMEBACK_FANS_LOG_CAP,
    Math.log10(draft.idol.social.fans + 1) * B.COMEBACK_FANS_LOG_MUL,
  );
  const base =
    B.COMEBACK_FOCUS_WEIGHT * skills[focus] +
    B.COMEBACK_CORE_WEIGHT * coreAverageOf(skills) +
    B.COMEBACK_VISUAL_WEIGHT * skills.visual +
    B.COMEBACK_FANS_WEIGHT * fansTerm;

  const selfProduced = draft.flags.self_produced === true;
  const selfMul = selfProduced
    ? skills[focus] >= B.SELF_PRODUCE_SKILL_LINE
      ? B.SELF_PRODUCE_HIGH_MUL
      : B.SELF_PRODUCE_LOW_MUL
    : 1;
  if (selfProduced) draft.flags.self_produced = false;

  const noise = drawRange(draft, -B.COMEBACK_SCORE_RNG, B.COMEBACK_SCORE_RNG);
  const score = round1(base * affinity * selfMul + noise);

  const tier = B.COMEBACK_TIERS.find((t) => score >= t.minScore) ?? B.COMEBACK_TIERS[B.COMEBACK_TIERS.length - 1];
  const fansBefore = draft.idol.social.fans;
  const raw = Math.round(fansBefore * tier.fansPct);
  const fansGained = tier.fansPct > 0 ? Math.max(tier.fansFloor, raw) : raw;

  addFans(draft, fansGained);
  addMoney(draft, tier.money);
  addReputation(draft, tier.reputation);
  if (tier.stress !== 0) addStress(draft, tier.stress);
  if (tier.rank === "top1") {
    draft.career.topRankCount += 1;
    if (!draft.flags.cg_first_win) draft.flags.cg_first_win = true;
  }

  const conceptLabel = getConcept(concept).label;
  const lines = [comebackHeadline(tier.rank, conceptLabel), affinityHint(affinity)];
  if (selfProduced) {
    lines.push(
      selfMul >= 1
        ? "하람이 직접 쓴 곡이었다. 도박은 성공했다."
        : "하람이 직접 쓴 곡이었다. 아직은 이른 도전이었다.",
    );
  }
  lines.push(
    `팬 ${fansGained >= 0 ? "+" : "−"}${formatFans(Math.abs(fansGained))} · 자금 +${tier.money}만원`,
  );

  const record: ComebackRecord = {
    month: draft.month,
    concept,
    focus,
    score,
    rank: tier.rank,
    fansGained,
    moneyGained: tier.money,
    text: lines.join("\n"),
  };

  draft.career.comebacks.push(record);
  draft.career.lastComebackMonth = draft.month;
  const next = draft.month + B.COMEBACK_INTERVAL;
  draft.career.nextComebackMonth = next <= TOTAL_MONTHS ? next : null;
  draft.ui.lastComeback = record;
  updatePhase(draft);
  return record;
}

// ---------------------------------------------------------------------------
// 연말 시상식
// ---------------------------------------------------------------------------

export function isAwardMonth(month: number): boolean {
  return B.AWARD_MONTHS.includes(month);
}

function top1CountThisYear(state: GameState): number {
  const year = Math.ceil(state.month / B.MONTHS_PER_YEAR);
  const from = (year - 1) * B.MONTHS_PER_YEAR + 1;
  const to = year * B.MONTHS_PER_YEAR;
  return state.career.comebacks.filter((c) => c.rank === "top1" && c.month >= from && c.month <= to)
    .length;
}

function qualifies(draft: GameState, award: AwardId): boolean {
  const fans = draft.idol.social.fans;
  switch (award) {
    case "rookie":
      return !draft.flags.rookie_award_checked && fans >= B.AWARD_ROOKIE_MIN_FANS;
    case "bonsang":
      return fans >= B.AWARD_BONSANG_MIN_FANS;
    case "daesang":
      return (
        fans >= B.AWARD_DAESANG_MIN_FANS &&
        coreAverageOf(draft.idol.skills) >= B.AWARD_DAESANG_MIN_CORE_AVG
      );
    case "popularity":
      return top1CountThisYear(draft) >= B.AWARD_POPULARITY_MIN_TOP1;
  }
}

function applyAward(draft: GameState, award: AwardId): void {
  switch (award) {
    case "rookie":
      addFans(draft, Math.round(draft.idol.social.fans * B.AWARD_ROOKIE_FANS_PCT));
      addReputation(draft, B.AWARD_ROOKIE_REPUTATION);
      addBond(draft, B.AWARD_ROOKIE_BOND);
      break;
    case "bonsang":
      addFans(draft, Math.round(draft.idol.social.fans * B.AWARD_BONSANG_FANS_PCT));
      addMoney(draft, B.AWARD_BONSANG_MONEY);
      break;
    case "daesang":
      addFans(draft, Math.round(draft.idol.social.fans * B.AWARD_DAESANG_FANS_PCT));
      addMoney(draft, B.AWARD_DAESANG_MONEY);
      addReputation(draft, B.AWARD_DAESANG_REPUTATION);
      draft.flags.cg_award_grand_prize = true;
      break;
    case "popularity":
      addFans(draft, Math.round(draft.idol.social.fans * B.AWARD_POPULARITY_FANS_PCT));
      break;
  }
}

/** 시상식을 진행하고 수상 목록을 반환한다 (draft 를 직접 변경) */
export function grantAwards(draft: GameState): AwardRecord[] {
  const won: AwardRecord[] = [];
  for (const award of B.AWARD_ORDER) {
    if (!qualifies(draft, award)) continue;
    applyAward(draft, award);
    const record: AwardRecord = { month: draft.month, award };
    draft.career.awards.push(record);
    won.push(record);
  }
  draft.flags.rookie_award_checked = true;
  updatePhase(draft);
  return won;
}
