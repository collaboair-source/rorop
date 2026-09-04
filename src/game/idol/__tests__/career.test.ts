import { describe, expect, it } from "vitest";

import * as E from "../engine";
import { grantAwards } from "../engine/career";
import { CORE_SKILL_IDS, type ComebackFocus, type ConceptId, type GameState } from "../types";
import { mutate, newGame } from "./helpers";

function withCore(state: GameState, value: number): GameState {
  return mutate(state, (d) => {
    for (const id of CORE_SKILL_IDS) d.idol.skills[id] = value;
  });
}

function comebackState(skill: number, fans: number, month = 12): GameState {
  return mutate(withCore(newGame({ background: "dance_academy", personality: "diligent" }), skill), (d) => {
    d.month = month;
    d.career.debuted = true;
    d.career.debutMonth = month - 4;
    d.career.phase = "rookie";
    d.career.nextComebackMonth = month;
    d.idol.social.fans = fans;
    d.ui.phase = "comeback";
  });
}

function runComeback(state: GameState, concept: ConceptId, focus: ComebackFocus) {
  const after = E.chooseComeback(state, concept, focus);
  const record = after.ui.lastComeback;
  if (!record) throw new Error("컴백 기록 없음");
  return { after, record };
}

describe("데뷔 평가 신청 조건", () => {
  it("6개월차 전에는 신청할 수 없다", () => {
    const state = mutate(withCore(newGame(), 60), (d) => {
      d.month = 5;
      d.idol.social.fans = 10_000;
    });
    expect(E.canRequestDebutEval(state).ok).toBe(false);
    expect(E.canRequestDebutEval(state).reason).toContain("6개월차");
  });

  it("코어 평균 40 미만이면 신청할 수 없다", () => {
    const state = mutate(withCore(newGame(), 30), (d) => {
      d.month = 8;
      d.idol.social.fans = 10_000;
    });
    const check = E.canRequestDebutEval(state);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("코어");
  });

  it("팬 3,000 미만이면 신청할 수 없다", () => {
    const state = mutate(withCore(newGame(), 60), (d) => {
      d.month = 8;
      d.idol.social.fans = 1000;
    });
    const check = E.canRequestDebutEval(state);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("팬");
  });

  it("조건을 채우면 신청할 수 있다", () => {
    const state = mutate(withCore(newGame(), 60), (d) => {
      d.month = 8;
      d.idol.social.fans = 10_000;
    });
    expect(E.canRequestDebutEval(state).ok).toBe(true);
  });
});

describe("데뷔 평가 결과", () => {
  it("통과하면 데뷔·팬 증가·컴백 예약이 이루어진다", () => {
    const state = mutate(withCore(newGame({ seed: 555 }), 75), (d) => {
      d.month = 8;
      d.idol.social.fans = 20_000;
    });
    const evaluated = E.requestDebutEval(state);
    expect(evaluated.ui.phase).toBe("debut_eval");
    const result = evaluated.ui.lastDebutEval;
    expect(result?.passed).toBe(true);
    expect(evaluated.career.debuted).toBe(true);
    expect(evaluated.career.debutMonth).toBe(8);
    expect(evaluated.career.nextComebackMonth).toBe(12);
    expect(evaluated.career.phase).toBe("rookie");
    expect(evaluated.idol.social.fans).toBeGreaterThan(20_000 + 15_000);
    expect(evaluated.idol.social.reputation).toBe(55);
    expect(evaluated.idol.condition.stress).toBe(20);
    expect(evaluated.flags.just_debuted).toBe(true);

    const confirmed = E.confirmDebutEval(evaluated);
    expect(confirmed.ui.phase).toBe("planning");
  });

  it("실패하면 실패 횟수가 늘고 2개월간 재신청할 수 없다", () => {
    const state = mutate(withCore(newGame({ seed: 4 }), 40), (d) => {
      d.month = 8;
      d.idol.skills.visual = 40;
      d.idol.social.fans = 3000;
    });
    const evaluated = E.requestDebutEval(state);
    expect(evaluated.ui.lastDebutEval?.passed).toBe(false);
    expect(evaluated.career.debuted).toBe(false);
    expect(evaluated.career.debutEvalFailures).toBe(1);
    expect(evaluated.career.lastDebutEvalMonth).toBe(8);
    expect(evaluated.idol.condition.stress).toBe(10 + 10 + 15);

    const next = mutate(E.confirmDebutEval(evaluated), (d) => {
      d.month = 9;
    });
    expect(E.canRequestDebutEval(next).ok).toBe(false);
    const later = mutate(next, (d) => {
      d.month = 10;
    });
    expect(E.canRequestDebutEval(later).ok).toBe(true);
  });
});

describe("컴백", () => {
  it("점수 구간이 4단계로 매핑된다", () => {
    expect(runComeback(comebackState(100, 3_000_000), "fresh", "dance").record.rank).toBe("top1");
    expect(runComeback(comebackState(80, 100_000), "fresh", "dance").record.rank).toBe("top10");
    expect(runComeback(comebackState(62, 100_000), "fresh", "dance").record.rank).toBe("top50");
    expect(runComeback(comebackState(40, 1000), "fresh", "dance").record.rank).toBe("fail");
  });

  it("1위는 팬·자금·평판을 크게 올리고 topRankCount 를 센다", () => {
    const state = comebackState(100, 3_000_000);
    const { after, record } = runComeback(state, "fresh", "dance");
    expect(record.rank).toBe("top1");
    expect(after.career.topRankCount).toBe(1);
    expect(record.fansGained).toBe(Math.max(50_000, Math.round(3_000_000 * 0.6)));
    expect(after.economy.money).toBe(state.economy.money + 800);
    expect(after.idol.social.reputation).toBe(state.idol.social.reputation + 3);
    expect(after.flags.cg_first_win).toBe(true);
    expect(after.career.nextComebackMonth).toBe(16);
  });

  it("차트 진입 실패는 팬이 줄고 스트레스가 오른다", () => {
    const state = comebackState(40, 100_000);
    const { after, record } = runComeback(state, "fresh", "dance");
    expect(record.rank).toBe("fail");
    expect(after.idol.social.fans).toBeLessThan(100_000);
    expect(after.idol.condition.stress).toBe(state.idol.condition.stress + 10);
  });

  it("콘셉트 적성이 점수에 곱해진다", () => {
    const base = mutate(comebackState(70, 100_000), (d) => {
      d.idol.conceptAffinity.ballad = 1.15;
      d.idol.conceptAffinity.hiphop = 0.85;
    });
    const good = runComeback(base, "ballad", "vocal").record;
    const bad = runComeback(base, "hiphop", "vocal").record;
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.text).toContain("잘 어울렸다");
    expect(bad.text).toContain("어색하다");
  });

  it("자작곡 플래그는 포커스 능력치에 따라 배수를 바꾸고 소모된다", () => {
    const high = mutate(comebackState(80, 100_000), (d) => {
      d.flags.self_produced = true;
    });
    const plain = comebackState(80, 100_000);
    const withSelf = runComeback(high, "fresh", "dance");
    const without = runComeback(plain, "fresh", "dance");
    expect(withSelf.record.score).toBeGreaterThan(without.record.score);
    expect(withSelf.after.flags.self_produced).toBe(false);

    const low = mutate(comebackState(60, 100_000), (d) => {
      d.flags.self_produced = true;
    });
    const lowResult = runComeback(low, "fresh", "dance");
    const lowPlain = runComeback(comebackState(60, 100_000), "fresh", "dance");
    expect(lowResult.record.score).toBeLessThan(lowPlain.record.score);
  });

  it("36개월차를 넘어가는 다음 컴백은 예약되지 않는다", () => {
    const state = comebackState(80, 100_000, 34);
    const { after } = runComeback(state, "fresh", "dance");
    expect(after.career.nextComebackMonth).toBeNull();
  });

  it("confirmComeback 은 planning 으로 넘긴다", () => {
    const { after } = runComeback(comebackState(80, 100_000), "fresh", "dance");
    expect(E.confirmComeback(after).ui.phase).toBe("planning");
  });
});

describe("연말 시상식", () => {
  function awardState(fans: number, extra: (d: GameState) => void = () => {}): GameState {
    return mutate(withCore(newGame(), 60), (d) => {
      d.month = 12;
      d.career.debuted = true;
      d.career.phase = "rising";
      d.idol.social.fans = fans;
      extra(d);
    });
  }

  it("신인상: 데뷔 후 첫 시상식 + 팬 20만 이상", () => {
    const draft = structuredClone(awardState(250_000));
    const awards = grantAwards(draft);
    expect(awards.map((a) => a.award)).toContain("rookie");
    expect(draft.idol.social.fans).toBe(275_000);
    expect(draft.flags.rookie_award_checked).toBe(true);

    const second = structuredClone(awardState(250_000, (d) => {
      d.flags.rookie_award_checked = true;
    }));
    expect(grantAwards(second).map((a) => a.award)).not.toContain("rookie");
  });

  it("본상: 팬 100만 이상", () => {
    const draft = structuredClone(awardState(1_200_000, (d) => {
      d.flags.rookie_award_checked = true;
    }));
    const awards = grantAwards(draft);
    expect(awards.map((a) => a.award)).toEqual(["bonsang"]);
    expect(draft.economy.money).toBe(300 + 300);
  });

  it("대상: 팬 300만 + 코어 평균 80 이상", () => {
    const notEnough = structuredClone(awardState(3_500_000, (d) => {
      d.flags.rookie_award_checked = true;
    }));
    expect(grantAwards(notEnough).map((a) => a.award)).not.toContain("daesang");

    const draft = structuredClone(
      mutate(withCore(awardState(3_500_000), 85), (d) => {
        d.flags.rookie_award_checked = true;
      }),
    );
    const awards = grantAwards(draft);
    expect(awards.map((a) => a.award)).toContain("daesang");
    expect(draft.flags.cg_award_grand_prize).toBe(true);
  });

  it("인기상: 해당 연도 1위 2회 이상", () => {
    const draft = structuredClone(
      awardState(100_000, (d) => {
        d.flags.rookie_award_checked = true;
        d.career.comebacks = [
          { month: 4, concept: "fresh", focus: "dance", score: 90, rank: "top1", fansGained: 0, moneyGained: 0, text: "" },
          { month: 8, concept: "fresh", focus: "dance", score: 90, rank: "top1", fansGained: 0, moneyGained: 0, text: "" },
        ];
      }),
    );
    expect(grantAwards(draft).map((a) => a.award)).toEqual(["popularity"]);
  });

  it("지난 연도의 1위는 올해 인기상에 세지 않는다", () => {
    const draft = structuredClone(
      awardState(100_000, (d) => {
        d.month = 24;
        d.flags.rookie_award_checked = true;
        d.career.comebacks = [
          { month: 4, concept: "fresh", focus: "dance", score: 90, rank: "top1", fansGained: 0, moneyGained: 0, text: "" },
          { month: 8, concept: "fresh", focus: "dance", score: 90, rank: "top1", fansGained: 0, moneyGained: 0, text: "" },
        ];
      }),
    );
    expect(grantAwards(draft).map((a) => a.award)).not.toContain("popularity");
  });
});

describe("상태 머신 분기", () => {
  it("12개월차 데뷔 상태의 리포트 확인은 시상식으로 간다", () => {
    const state = mutate(withCore(newGame(), 60), (d) => {
      d.month = 12;
      d.career.debuted = true;
      d.career.phase = "rising";
      d.idol.social.fans = 250_000;
      d.ui.phase = "report";
    });
    const awarded = E.confirmReport(state);
    expect(awarded.ui.phase).toBe("award");
    expect(awarded.ui.lastAwards.length).toBeGreaterThan(0);
    const next = E.confirmAward(awarded);
    expect(next.month).toBe(13);
    expect(next.ui.phase).toBe("planning");
  });

  it("24개월차까지 데뷔하지 못하면 계약 종료 엔딩", () => {
    const state = mutate(newGame(), (d) => {
      d.month = 24;
      d.ui.phase = "report";
    });
    const ended = E.confirmReport(state);
    expect(ended.ui.phase).toBe("ended");
    expect(ended.ending?.id).toBe("contract_terminated");
  });

  it("36개월차는 시상식 뒤 엔딩으로 끝난다", () => {
    const state = mutate(withCore(newGame(), 60), (d) => {
      d.month = 36;
      d.career.debuted = true;
      d.career.phase = "rising";
      d.idol.social.fans = 400_000;
      d.ui.phase = "report";
    });
    const awarded = E.confirmReport(state);
    expect(awarded.ui.phase).toBe("award");
    const ended = E.confirmAward(awarded);
    expect(ended.ui.phase).toBe("ended");
    expect(ended.ending).not.toBeNull();
  });

  it("컴백 달이면 다음 달 계획 전에 컴백 화면이 뜬다", () => {
    const state = mutate(withCore(newGame(), 60), (d) => {
      d.month = 11;
      d.career.debuted = true;
      d.career.phase = "rookie";
      d.career.nextComebackMonth = 12;
      d.idol.social.fans = 50_000;
      d.ui.phase = "report";
    });
    const next = E.confirmReport(state);
    expect(next.month).toBe(12);
    expect(next.ui.phase).toBe("comeback");
  });
});
