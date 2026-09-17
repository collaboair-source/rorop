// Claude 로 공고 ↔ 내 사업 적합도 분석 + 지원 가이드 생성.
// - 구조화 출력(zod) 으로 안정적인 JSON 을 받는다
// - 시스템 프롬프트와 사업 프로필은 cache_control 로 캐시해 여러 공고를 연속 분석할 때 비용을 줄인다
// - 서버측 fallbacks("default") 를 켜 두어 정책상 거절 시 다른 모델로 자동 재시도한다

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { BusinessProfile, MatchResult, ProgramAnalysis, SupportProgram } from "./types";
import { SOURCE_LABEL } from "./types";
import { profileHash } from "./store";
import { companyAgeYears } from "./matching";
import { toISODate } from "./text";

export const DEFAULT_MODEL = "claude-opus-5";

const EligibilitySchema = z.object({
  requirement: z.string(),
  status: z.enum(["충족", "미충족", "불명확"]),
  note: z.string(),
});

const StretchAngleSchema = z.object({
  angle: z.string(),
  how: z.string(),
  risk: z.enum(["낮음", "보통", "높음"]),
});

const RequirementToAcquireSchema = z.object({
  requirement: z.string(),
  why: z.string(),
  how: z.string(),
  effort: z.string(),
  lead_time: z.string(),
});

const PlanSectionSchema = z.object({
  section: z.string(),
  points: z.array(z.string()),
});

const ApplicationGuideSchema = z.object({
  timeline: z.array(z.string()),
  documents: z.array(z.string()),
  plan_outline: z.array(PlanSectionSchema),
  key_messages: z.array(z.string()),
  evaluation_focus: z.array(z.string()),
});

export const AnalysisSchema = z.object({
  fit_score: z.number().int(),
  fit_level: z.enum(["높음", "보통", "낮음", "불가"]),
  recommended_action: z.enum(["지원 권장", "각도 조정 후 지원", "요건 확보 후 지원", "패스"]),
  summary: z.string(),
  eligibility: z.array(EligibilitySchema),
  direct_angles: z.array(z.string()),
  stretch_angles: z.array(StretchAngleSchema),
  requirements_to_acquire: z.array(RequirementToAcquireSchema),
  application_guide: ApplicationGuideSchema,
  risks: z.array(z.string()),
  next_steps: z.array(z.string()),
});

export type AnalysisOutput = z.infer<typeof AnalysisSchema>;

const SYSTEM_PROMPT = `당신은 한국 정부·지자체·공공기관 지원사업(기업마당, K-Startup 등) 전문 컨설턴트다.
한 스타트업/중소기업의 사업 프로필과 지원사업 공고가 주어지면, 그 회사가 이 공고에 지원할 수 있는지와 어떻게 하면 선정 가능성을 높일 수 있는지를 분석한다.

분석 원칙:
1. 공고에 명시된 신청 자격·제외 대상·사업경력·지역·연령·인증 요건을 하나씩 뽑아 "충족 / 미충족 / 불명확" 으로 판정한다. 프로필에 정보가 없으면 추측하지 말고 "불명확" 으로 두고 무엇을 확인해야 하는지 적는다.
2. direct_angles: 현재 사업 내용을 그대로 두고도 이 공고의 취지·평가 기준에 맞춰 어필할 수 있는 포인트를 쓴다.
3. stretch_angles: 현재 사업과 공고 취지가 딱 맞지 않더라도, 사업을 재해석·확장·포장해서 요건 안에 "끼워 넣을" 수 있는 각도를 적극적으로 제안한다. (예: 디자인 협업 SaaS → "소상공인 디지털 전환 도구", "콘텐츠 산업 생산성 솔루션", "AI 활용 서비스" 등) 각 각도마다 사업계획서에 실제로 어떻게 쓸지(how)와 심사에서 억지스럽게 보일 위험(risk)을 함께 적는다. 허위 기재는 절대 제안하지 않는다. 사실에 기반한 재해석과 거짓의 경계를 분명히 한다.
4. requirements_to_acquire: 지금은 없지만 새로 갖추면 지원 자격이 생기거나 가점을 받을 수 있는 요건(예: 벤처기업확인, 기업부설연구소/연구개발전담부서 설립, 여성기업확인, 사업자등록, 특정 지역 사업장 등록, 특허 출원, 고용 계획, 협약 파트너 확보 등)을 구체적인 확보 방법(담당 기관, 절차, 대략 비용/난이도, 소요 기간)과 함께 적는다. 이 공고와 무관한 요건은 넣지 않는다.
5. application_guide: 마감일에서 역산한 일정, 준비 서류, 사업계획서 목차(문제 인식 → 실현 가능성 → 성장 전략 → 팀 역량 등 해당 공고 양식에 맞게)별 핵심 포인트, 심사위원에게 전달할 핵심 메시지, 예상 평가 지표와 대응을 적는다.
6. fit_score 는 0~100. 자격 요건 충족 여부를 가장 크게 보고, 사업 적합성·경쟁력·확보 가능한 요건을 반영한다. 결격 요건이 하나라도 확실하면 40 이하. fit_level 은 점수와 일관되게(80 이상 높음, 55~79 보통, 30~54 낮음, 30 미만 불가).
7. recommended_action: 요건을 대부분 충족하면 "지원 권장", 사업을 재해석하면 가능하면 "각도 조정 후 지원", 새 요건을 갖추면 가능하면 "요건 확보 후 지원", 마감·요건상 현실적으로 불가하면 "패스".
8. 사용자의 stretch_tolerance(끼워 맞추기 허용 정도)가 aggressive 면 위험이 높더라도 각도를 더 많이, conservative 면 위험 낮은 각도 위주로 제안한다.
9. 모든 문장은 한국어로, 구체적으로, 실행 가능하게 쓴다. 공고 내용을 재진술하는 데 지면을 낭비하지 않는다.`;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function currentModel(): string {
  return process.env.SUPPORT_AI_MODEL || DEFAULT_MODEL;
}

export function renderProfile(profile: BusinessProfile, today = toISODate(new Date())): string {
  const age = companyAgeYears(profile, today);
  const lines = [
    `회사명: ${profile.company_name || "(미입력)"}`,
    `사업 형태: ${profile.business_type}${profile.founded_at ? ` (창업일 ${profile.founded_at}, 창업 후 ${age?.toFixed(1)}년)` : ""}`,
    `업종: ${profile.industry || "(미입력)"}`,
    `사업 설명: ${profile.description || "(미입력)"}`,
    `주요 제품/서비스: ${profile.products || "(미입력)"}`,
    `핵심 키워드: ${profile.keywords.join(", ") || "(없음)"}`,
    `사업장 소재지: ${profile.region || "(미입력)"}`,
    `임직원 수: ${profile.employees}명`,
    `연 매출: ${profile.annual_revenue_million_krw}백만원`,
    `보유 인증/자격: ${profile.certifications.join(", ") || "(없음)"}`,
    `대표자: ${profile.representative_age !== null ? `만 ${profile.representative_age}세` : "나이 미입력"}, ${
      profile.representative_gender === "female" ? "여성" : profile.representative_gender === "male" ? "남성" : "성별 미입력"
    }`,
    `관심 지원 분야: ${profile.interests.join(", ") || "(없음)"}`,
    `지원사업으로 얻고 싶은 것: ${profile.goals || "(미입력)"}`,
    `제약/메모: ${profile.constraints || "(없음)"}`,
    `끼워 맞추기 허용 정도(stretch_tolerance): ${profile.stretch_tolerance}`,
  ];
  return lines.join("\n");
}

export function renderProgram(program: SupportProgram, match?: MatchResult | null): string {
  const lines = [
    `출처: ${SOURCE_LABEL[program.source]}`,
    `공고명: ${program.title}`,
    `지원분야: ${[program.category, program.subcategory].filter(Boolean).join(" > ") || "(미상)"}`,
    `소관/공고기관: ${program.organization || "(미상)"}${program.executing_org ? ` / 수행: ${program.executing_org}` : ""}`,
    `지원지역: ${program.region || "(미상)"}`,
    `지원대상: ${program.target || "(미상)"}`,
    program.target_detail ? `신청대상 상세: ${program.target_detail}` : "",
    program.exclusion ? `제외대상: ${program.exclusion}` : "",
    program.business_age ? `사업경력 조건: ${program.business_age}` : "",
    program.target_age ? `대상 연령: ${program.target_age}` : "",
    `접수기간: ${program.apply_start || "?"} ~ ${program.apply_end || "미상(상시/예산 소진 시)"}`,
    program.apply_method ? `신청방법: ${program.apply_method}` : "",
    program.contact ? `문의: ${program.contact}` : "",
    `URL: ${program.url}`,
    program.hashtags.length ? `해시태그: ${program.hashtags.join(", ")}` : "",
    "",
    `사업 개요:\n${program.summary || "(개요 없음 — 공고 URL 을 참고해 일반적인 유사 사업 기준으로 추정하되, 추정임을 명시)"}`,
  ];
  if (match) {
    lines.push("", `규칙 기반 사전 점수: ${match.score}/100`);
    if (match.hard_blockers.length) lines.push(`사전 감지된 결격 가능성: ${match.hard_blockers.join("; ")}`);
    if (match.matched_keywords.length) lines.push(`일치 키워드: ${match.matched_keywords.join(", ")}`);
  }
  return lines.filter((l) => l !== "").join("\n");
}

export interface AnalyzeOptions {
  client?: Anthropic;
  model?: string;
  today?: string;
}

/** 공고 하나를 분석해 ProgramAnalysis 를 돌려준다 (저장은 호출측에서) */
export async function analyzeProgram(program: SupportProgram, profile: BusinessProfile, match: MatchResult | null, opts: AnalyzeOptions = {}): Promise<ProgramAnalysis> {
  const client = opts.client || new Anthropic();
  const model = opts.model || currentModel();
  const today = opts.today || toISODate(new Date());

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: `[내 사업 프로필]\n${renderProfile(profile, today)}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `오늘 날짜: ${today}\n\n[지원사업 공고]\n${renderProgram(program, match)}\n\n위 공고에 대해 내 사업의 적합도를 분석하고 지원 가이드를 작성해줘.`,
      },
    ],
    output_config: { format: betaZodOutputFormat(AnalysisSchema), effort: "high" },
  });

  if (response.stop_reason === "refusal") {
    const detail = response.stop_details && "explanation" in response.stop_details ? response.stop_details.explanation : "";
    throw new Error(`모델이 응답을 거절했습니다. ${detail || ""}`.trim());
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("응답이 max_tokens 에 잘렸습니다. 다시 시도해 주세요.");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("구조화 출력 파싱에 실패했습니다. 다시 시도해 주세요.");
  }

  return {
    program_id: program.id,
    profile_hash: profileHash(profile),
    model: response.model || model,
    created_at: new Date().toISOString(),
    ...parsed,
    fit_score: Math.max(0, Math.min(100, Math.round(parsed.fit_score))),
  };
}

/** 분석 결과를 마크다운으로 (복사/공유용) */
export function analysisToMarkdown(program: SupportProgram, analysis: ProgramAnalysis): string {
  const out: string[] = [];
  out.push(`# ${program.title}`);
  out.push(`- 출처: ${SOURCE_LABEL[program.source]} · ${program.url}`);
  out.push(`- 접수: ${program.apply_start || "?"} ~ ${program.apply_end || "미상"}`);
  out.push(`- 적합도: **${analysis.fit_score}점 (${analysis.fit_level})** → ${analysis.recommended_action}`);
  out.push("", `## 요약`, analysis.summary);
  out.push("", `## 자격 요건 체크`);
  for (const e of analysis.eligibility) out.push(`- [${e.status}] ${e.requirement}${e.note ? ` — ${e.note}` : ""}`);
  if (analysis.direct_angles.length) {
    out.push("", `## 지금 사업 그대로 어필할 포인트`);
    for (const a of analysis.direct_angles) out.push(`- ${a}`);
  }
  if (analysis.stretch_angles.length) {
    out.push("", `## 끼워 맞추기 각도 (재해석/확장)`);
    for (const s of analysis.stretch_angles) out.push(`- **${s.angle}** (위험 ${s.risk}): ${s.how}`);
  }
  if (analysis.requirements_to_acquire.length) {
    out.push("", `## 새로 확보하면 되는 요건`);
    for (const r of analysis.requirements_to_acquire) out.push(`- **${r.requirement}**: ${r.why}\n  - 방법: ${r.how}\n  - 난이도/비용: ${r.effort} · 소요: ${r.lead_time}`);
  }
  const g = analysis.application_guide;
  out.push("", `## 지원 가이드`, `### 일정`);
  for (const t of g.timeline) out.push(`- ${t}`);
  out.push(`### 준비 서류`);
  for (const d of g.documents) out.push(`- ${d}`);
  out.push(`### 사업계획서 목차별 포인트`);
  for (const s of g.plan_outline) {
    out.push(`- **${s.section}**`);
    for (const p of s.points) out.push(`  - ${p}`);
  }
  out.push(`### 핵심 메시지`);
  for (const k of g.key_messages) out.push(`- ${k}`);
  out.push(`### 예상 평가 지표와 대응`);
  for (const e of g.evaluation_focus) out.push(`- ${e}`);
  if (analysis.risks.length) {
    out.push("", `## 리스크`);
    for (const r of analysis.risks) out.push(`- ${r}`);
  }
  if (analysis.next_steps.length) {
    out.push("", `## 다음 할 일`);
    for (const n of analysis.next_steps) out.push(`- [ ] ${n}`);
  }
  out.push("", `_분석 모델: ${analysis.model} · ${analysis.created_at}_`);
  return out.join("\n");
}
