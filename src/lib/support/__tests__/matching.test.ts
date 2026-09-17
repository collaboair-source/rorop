import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreProgram, computeStatus, companyAgeYears } from "../matching";
import { buildProgram } from "../normalize";
import { DEFAULT_PROFILE } from "../profile-default";
import type { BusinessProfile } from "../types";

const TODAY = "2026-09-17";

const profile: BusinessProfile = {
  ...DEFAULT_PROFILE,
  company_name: "테스트",
  business_type: "법인",
  founded_at: "2025-03-01",
  region: "서울",
  keywords: ["SaaS", "디자인", "협업툴"],
  interests: ["창업", "기술"],
  representative_age: 34,
  representative_gender: "male",
};

function program(over: Partial<Parameters<typeof buildProgram>[0]> = {}) {
  return buildProgram({
    source: "bizinfo",
    external_id: over.external_id || "X1",
    title: "중소기업 디자인 SaaS 개발 지원",
    summary: "디자인 협업툴 등 소프트웨어 개발을 지원",
    category: "기술",
    target: "창업 7년 이내 중소기업",
    region: "전국",
    apply_end: "2026-10-30",
    ...over,
  });
}

test("status: closed / closing_soon / open / unknown", () => {
  assert.equal(computeStatus(program({ apply_end: "2026-09-01" }), TODAY).status, "closed");
  assert.equal(computeStatus(program({ apply_end: "2026-09-20" }), TODAY).status, "closing_soon");
  assert.equal(computeStatus(program({ apply_end: "2026-10-30" }), TODAY).status, "open");
  assert.equal(computeStatus(program({ apply_end: null }), TODAY).status, "unknown");
});

test("company age is computed from founded_at", () => {
  assert.ok(Math.abs((companyAgeYears(profile, TODAY) || 0) - 1.55) < 0.05);
  assert.equal(companyAgeYears({ ...profile, business_type: "예비창업자" }, TODAY), null);
});

test("closed programs score 0", () => {
  const m = scoreProgram(program({ apply_end: "2026-09-01" }), profile, TODAY);
  assert.equal(m.score, 0);
  assert.equal(m.status, "closed");
});

test("keyword, interest, region and stage matches add up", () => {
  const m = scoreProgram(program(), profile, TODAY);
  assert.ok(m.score >= 70, `score=${m.score} reasons=${JSON.stringify(m.reasons)}`);
  assert.deepEqual(m.hard_blockers, []);
  assert.ok(m.matched_keywords.includes("SaaS"));
  assert.ok(m.reasons.some((r) => r.label.startsWith("관심 분야 일치")));
  assert.ok(m.reasons.some((r) => r.label === "창업 단계 조건 충족"));
});

test("region mismatch is a hard blocker capped at 35", () => {
  const m = scoreProgram(program({ region: "부산,경남" }), profile, TODAY);
  assert.ok(m.hard_blockers.some((b) => b.startsWith("지역 불일치")));
  assert.ok(m.score <= 35);
});

test("예비창업자 전용 공고 blocks an incorporated company", () => {
  const m = scoreProgram(program({ title: "예비창업패키지", target: "예비창업자", summary: "" }), profile, TODAY);
  assert.ok(m.hard_blockers.includes("예비창업자 전용 공고"));
  const pre = scoreProgram(program({ title: "예비창업패키지", target: "예비창업자", summary: "" }), { ...profile, business_type: "예비창업자", founded_at: null }, TODAY);
  assert.deepEqual(pre.hard_blockers, []);
});

test("kstartup business_age list is evaluated against company age", () => {
  const ok = scoreProgram(program({ source: "kstartup", business_age: "예비창업자,3년미만,5년미만" }), profile, TODAY);
  assert.ok(ok.reasons.some((r) => r.label.startsWith("사업경력 조건 충족")));
  const bad = scoreProgram(program({ source: "kstartup", business_age: "7년이상" }), profile, TODAY);
  assert.ok(bad.hard_blockers.some((b) => b.startsWith("사업경력 조건 불일치")));
  const older = scoreProgram(program({ target: "창업 1년 이내 기업" }), profile, TODAY);
  assert.ok(older.hard_blockers.some((b) => b.includes("창업 1년 이내")));
});

test("youth and women-only programs check representative info", () => {
  const youth = scoreProgram(program({ title: "청년창업사관학교" }), profile, TODAY);
  assert.ok(youth.reasons.some((r) => r.label === "청년 요건 충족"));
  const old = scoreProgram(program({ title: "청년창업사관학교" }), { ...profile, representative_age: 45 }, TODAY);
  assert.ok(old.hard_blockers.some((b) => b.startsWith("청년")));
  const women = scoreProgram(program({ target: "여성기업" }), profile, TODAY);
  assert.ok(women.hard_blockers.includes("여성기업/여성 창업자 대상 공고"));
  const womenOk = scoreProgram(program({ target: "여성기업" }), { ...profile, representative_gender: "female" }, TODAY);
  assert.deepEqual(womenOk.hard_blockers, []);
});
