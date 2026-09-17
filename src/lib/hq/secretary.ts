// The AI secretary: Claude-powered analysis, chat, briefings and task advice.
// All calls go through the official Anthropic SDK. When no credentials are
// configured the functions throw a SecretaryError with a friendly Korean
// message that the API routes forward to the UI.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Venture, Task, Comment, Priority, Proposal } from "./types";

export const SECRETARY_MODEL = process.env.SECRETARY_MODEL || "claude-opus-5";

/** Characters of source content we send for analysis before flagging truncation. */
const MAX_ANALYSIS_CHARS = 240_000;

export class SecretaryError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/**
 * Credentials are considered present when an API key / auth token env var is set,
 * or when HQ_AI_ENABLED=1 opts in explicitly (e.g. an `ant auth login` profile the
 * SDK resolves on its own).
 */
export function isAiConfigured(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;
  return process.env.HQ_AI_ENABLED === "1" || process.env.HQ_AI_ENABLED === "true";
}

export function configHint(): string | null {
  if (isAiConfigured()) return null;
  return "AI 비서를 켜려면 서버 환경변수 ANTHROPIC_API_KEY를 설정하고 서버를 재시작하세요.";
}

type GlobalWithClient = typeof globalThis & { __roropAnthropic?: Anthropic };
function getClient(): Anthropic {
  if (!isAiConfigured()) {
    throw new SecretaryError("AI 비서가 비활성화되어 있습니다. 서버에 ANTHROPIC_API_KEY를 설정하세요.", 503);
  }
  const g = globalThis as GlobalWithClient;
  if (!g.__roropAnthropic) g.__roropAnthropic = new Anthropic();
  return g.__roropAnthropic;
}

function toSecretaryError(err: unknown): SecretaryError {
  if (err instanceof SecretaryError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new SecretaryError("Anthropic API 키가 유효하지 않습니다. ANTHROPIC_API_KEY를 확인하세요.", 503);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new SecretaryError("AI 요청이 너무 많습니다. 잠시 후 다시 시도하세요.", 429);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new SecretaryError(`AI 요청 형식 오류: ${err.message}`, 502);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new SecretaryError("Anthropic API에 연결하지 못했습니다. 네트워크를 확인하세요.", 502);
  }
  if (err instanceof Anthropic.APIError) {
    return new SecretaryError(`AI 오류 (${err.status ?? "?"}): ${err.message}`, 502);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/api key|auth|credential/i.test(message)) {
    return new SecretaryError("Anthropic 인증 정보를 찾지 못했습니다. ANTHROPIC_API_KEY를 설정하세요.", 503);
  }
  return new SecretaryError(`AI 처리 중 오류: ${message}`, 500);
}

const PRIORITY_VALUES: Priority[] = ["P0", "P1", "P2", "P3"];
function safePriority(value: unknown): Priority {
  return PRIORITY_VALUES.includes(value as Priority) ? (value as Priority) : "P2";
}

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// ---------------------------------------------------------------------------
// Context rendering
// ---------------------------------------------------------------------------

export interface SecretaryContext {
  userName: string;
  today: string;
  ventures: Venture[];
  tasks: Task[];
  recentComments: Comment[];
}

const MAX_CONTEXT_TASKS = 80;
const MAX_CONTEXT_COMMENTS = 20;

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function renderContext(ctx: SecretaryContext): string {
  const lines: string[] = [];
  lines.push(`오늘: ${ctx.today}`);
  lines.push(`사용자: ${ctx.userName}`);
  lines.push("");
  lines.push(`## 사업 (${ctx.ventures.length}개)`);
  if (!ctx.ventures.length) lines.push("(등록된 사업 없음)");
  for (const v of ctx.ventures) {
    const bits = [`[${v.status}/${v.priority}]`, `id=${v.id}`, v.name];
    if (v.goal) bits.push(`목표: ${clip(v.goal, 120)}`);
    if (v.summary) bits.push(`요약: ${clip(v.summary, 200)}`);
    lines.push(`- ${bits.join(" | ")}`);
  }
  lines.push("");

  const open = ctx.tasks.filter((t) => t.status !== "done");
  const done = ctx.tasks
    .filter((t) => t.status === "done" && t.completed_at)
    .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""))
    .slice(0, 15);
  const ventureName = (id: string | null) => (id ? ctx.ventures.find((v) => v.id === id)?.name || "?" : "(사업 미지정)");

  lines.push(`## 열린 할 일 (${open.length}개${open.length > MAX_CONTEXT_TASKS ? `, 상위 ${MAX_CONTEXT_TASKS}개만 표시` : ""})`);
  const prioRank: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const shown = [...open]
    .sort((a, b) => {
      const da = a.due_date || "9999-99-99";
      const db = b.due_date || "9999-99-99";
      if (da !== db) return da.localeCompare(db);
      return prioRank[a.priority] - prioRank[b.priority];
    })
    .slice(0, MAX_CONTEXT_TASKS);
  if (!shown.length) lines.push("(열린 할 일 없음)");
  for (const t of shown) {
    const checklist = t.checklist.length ? ` 체크리스트 ${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : "";
    const due = t.due_date ? ` 기한 ${t.due_date}` : "";
    lines.push(`- [${t.status}/${t.priority}] id=${t.id} ${t.title} (${ventureName(t.venture_id)})${due}${checklist}${t.description ? ` — ${clip(t.description, 120)}` : ""}`);
  }
  lines.push("");
  if (done.length) {
    lines.push(`## 최근 완료 (${done.length}개)`);
    for (const t of done) lines.push(`- ${t.completed_at?.slice(0, 10)} ${t.title} (${ventureName(t.venture_id)})`);
    lines.push("");
  }
  const comments = ctx.recentComments.slice(0, MAX_CONTEXT_COMMENTS);
  if (comments.length) {
    lines.push(`## 최근 코멘트`);
    for (const c of comments) {
      lines.push(`- ${c.created_at.slice(0, 10)} [${c.author === "user" ? "사용자" : "비서"}] (${c.target_type} ${c.target_id}) ${clip(c.body, 160)}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function personaPrompt(userName: string): string {
  return [
    `당신은 ${userName}의 수석 비서(chief of staff)입니다. ${userName}은(는) 여러 사업을 동시에 이끄는 창업가이며, 세계 최고 수준의 경영자로 성장하는 것이 목표입니다.`,
    "",
    "역할:",
    "- 사업(venture)과 할 일(task)을 구조화하고, 우선순위를 분명히 하며, 실행을 밀어붙입니다.",
    "- 사업가의 시간을 아끼도록 핵심만 말합니다. 장식적인 문장, 아부, 뻔한 격려는 하지 않습니다.",
    "- 문제가 보이면 직설적으로 지적하고, 대안을 함께 제시합니다.",
    "- 할 일은 '동사로 시작하는 구체적 행동' 단위로 씁니다. 예: '투자자 A에게 데크 보내기', '견적서 초안 작성'.",
    "- 우선순위: P0=오늘 반드시/사업의 생사, P1=이번 주 중요, P2=보통, P3=여유.",
    "- 날짜는 YYYY-MM-DD 형식만 사용하고, 확실하지 않으면 null로 둡니다.",
    "- 항상 한국어로 답합니다.",
  ].join("\n");
}

const PrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);

const AnalysisSchema = z.object({
  summary: z.string().describe("이 자료의 핵심 요약. 3~6문장. 무엇을 하려는지, 어디까지 진행됐는지, 결정된 사항."),
  venture: z.object({
    name: z.string().describe("이 자료가 속한 사업의 이름. 기존 사업과 같으면 그 이름을 그대로 사용."),
    summary: z.string().describe("사업을 한두 문장으로 설명."),
    match_existing_id: z
      .string()
      .nullable()
      .describe("기존 사업 목록 중 이 자료가 속한 사업의 id. 새 사업이면 null."),
  }),
  tasks: z
    .array(
      z.object({
        title: z.string().describe("동사로 시작하는 구체적인 행동 (40자 이내)"),
        description: z.string().describe("왜 필요한지, 완료 기준은 무엇인지 1~2문장"),
        priority: PrioritySchema,
        due_date: z.string().nullable().describe("YYYY-MM-DD 또는 null"),
      })
    )
    .describe("자료에서 도출되는 아직 끝나지 않은 할 일. 이미 완료된 일은 제외. 최대 12개."),
  insights: z.array(z.string()).describe("비서로서의 관찰과 직언. 리스크, 놓친 점, 결정이 필요한 것. 최대 5개."),
});

export interface AnalysisInput {
  userName: string;
  today: string;
  title: string;
  kind: string;
  content: string;
  ventures: Venture[];
}

export interface AnalysisOutput extends z.infer<typeof AnalysisSchema> {
  truncated: boolean;
}

export async function analyzeKnowledge(input: AnalysisInput): Promise<AnalysisOutput> {
  const client = getClient();
  const truncated = input.content.length > MAX_ANALYSIS_CHARS;
  const body = truncated ? input.content.slice(0, MAX_ANALYSIS_CHARS) : input.content;
  const ventureList = input.ventures.length
    ? input.ventures.map((v) => `- id=${v.id} | ${v.name} [${v.status}] ${clip(v.summary, 120)}`).join("\n")
    : "(등록된 사업 없음)";

  const user = [
    `오늘: ${input.today}`,
    "",
    "## 기존 사업 목록",
    ventureList,
    "",
    `## 분석할 자료 (${input.kind}) — 제목: ${input.title}`,
    truncated ? "(자료가 길어 앞부분만 포함됨)" : "",
    "<자료>",
    body,
    "</자료>",
    "",
    "위 자료를 분석해 요약, 소속 사업, 남은 할 일, 비서의 관찰을 정리하세요. 기존 사업 중 같은 사업이 있으면 반드시 match_existing_id에 그 id를 넣으세요.",
  ].join("\n");

  try {
    const res = await client.beta.messages.parse({
      model: SECRETARY_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: personaPrompt(input.userName), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { format: betaZodOutputFormat(AnalysisSchema), effort: "high" },
    });
    if (res.stop_reason === "refusal") throw new SecretaryError("AI가 이 자료의 분석을 거절했습니다.");
    if (res.stop_reason === "max_tokens") throw new SecretaryError("AI 응답이 너무 길어 잘렸습니다. 자료를 나눠서 다시 시도하세요.");
    if (!res.parsed_output) throw new SecretaryError("AI 응답을 해석하지 못했습니다. 다시 시도하세요.");
    const parsed = res.parsed_output;
    return {
      ...parsed,
      tasks: parsed.tasks.map((t) => ({ ...t, priority: safePriority(t.priority), due_date: isValidDate(t.due_date) ? t.due_date : null })),
      truncated,
    };
  } catch (err) {
    throw toSecretaryError(err);
  }
}

const ChatSchema = z.object({
  reply: z.string().describe("사용자에게 보내는 답변 (마크다운 가능, 간결하게)"),
  proposals: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        priority: PrioritySchema,
        due_date: z.string().nullable().describe("YYYY-MM-DD 또는 null"),
        venture_id: z.string().nullable().describe("현재 상태에 있는 사업 id 중 하나, 없으면 null"),
        venture_name: z.string().nullable().describe("venture_id가 null인데 새 사업이 필요하면 이름, 아니면 null"),
      })
    )
    .describe("사용자가 승인하면 바로 등록될 할 일 제안. 요청과 무관하면 빈 배열."),
});

export interface ChatInput {
  context: SecretaryContext;
  history: { role: "user" | "secretary"; content: string }[];
  message: string;
}

export interface ChatOutput {
  reply: string;
  proposals: Proposal[];
}

export async function chatWithSecretary(input: ChatInput): Promise<ChatOutput> {
  const client = getClient();
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  messages.push({
    role: "user",
    content: `## 현재 상태\n${renderContext(input.context)}\n\n(위 상태를 바탕으로 아래 대화에 답하세요. 할 일을 만들자고 할 때는 proposals에 넣고, 답변에서는 짧게 언급만 하세요.)`,
  });
  for (const h of input.history.slice(-20)) {
    messages.push({ role: h.role === "user" ? "user" : "assistant", content: h.content || "(빈 메시지)" });
  }
  messages.push({ role: "user", content: input.message });

  try {
    const res = await client.beta.messages.parse({
      model: SECRETARY_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: personaPrompt(input.context.userName), cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { format: betaZodOutputFormat(ChatSchema), effort: "medium" },
    });
    if (res.stop_reason === "refusal") throw new SecretaryError("AI가 이 요청에 답하지 않았습니다.");
    if (res.stop_reason === "max_tokens") throw new SecretaryError("AI 응답이 너무 길어 잘렸습니다. 질문을 나눠서 다시 시도하세요.");
    if (!res.parsed_output) throw new SecretaryError("AI 응답을 해석하지 못했습니다. 다시 시도하세요.");
    const ventureById = new Map(input.context.ventures.map((v) => [v.id, v.name]));
    const proposals: Proposal[] = res.parsed_output.proposals
      .filter((p) => p.title && p.title.trim())
      .map((p) => {
        const ventureId = p.venture_id && ventureById.has(p.venture_id) ? p.venture_id : null;
        return {
          kind: "task" as const,
          title: p.title.trim(),
          description: p.description || "",
          priority: safePriority(p.priority),
          due_date: isValidDate(p.due_date) ? p.due_date : null,
          venture_id: ventureId,
          // Existing venture → its real name; otherwise the suggested new venture name (or null).
          venture_name: ventureId ? ventureById.get(ventureId) || null : (p.venture_name || "").trim() || null,
          accepted: false,
          task_id: null,
        };
      });
    return { reply: res.parsed_output.reply, proposals };
  } catch (err) {
    throw toSecretaryError(err);
  }
}

async function textCompletion(userName: string, user: string, effort: "low" | "medium" | "high"): Promise<string> {
  const client = getClient();
  try {
    const res = await client.beta.messages.create({
      model: SECRETARY_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: personaPrompt(userName), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort },
    });
    if (res.stop_reason === "refusal") throw new SecretaryError("AI가 이 요청에 답하지 않았습니다.");
    if (res.stop_reason === "max_tokens") throw new SecretaryError("AI 응답이 너무 길어 잘렸습니다. 다시 시도하세요.");
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) throw new SecretaryError("AI가 빈 응답을 보냈습니다. 다시 시도하세요.");
    return text;
  } catch (err) {
    throw toSecretaryError(err);
  }
}

export async function generateBriefing(context: SecretaryContext): Promise<string> {
  const user = [
    `## 현재 상태\n${renderContext(context)}`,
    "",
    "오늘의 브리핑을 마크다운으로 작성하세요. 구성:",
    "1. **오늘의 승부처** — 오늘 반드시 끝내야 할 일 최대 3개 (왜 그것인지 한 줄).",
    "2. **지연·리스크** — 기한이 지났거나 위험한 항목과 조치.",
    "3. **사업별 한 줄** — 각 사업의 현재 상태와 다음 한 걸음.",
    "4. **비서의 직언** — 지금 가장 중요한 판단 하나.",
    "전체 400자 내외. 할 일이 없으면 무엇부터 등록해야 할지 제안하세요.",
  ].join("\n");
  return textCompletion(context.userName, user, "medium");
}

export interface AdviseInput {
  context: SecretaryContext;
  task: Task;
  venture: Venture | null;
  comments: Comment[];
}

export async function adviseOnTask(input: AdviseInput): Promise<string> {
  const { task, venture, comments } = input;
  const user = [
    `## 현재 상태\n${renderContext(input.context)}`,
    "",
    "## 조언이 필요한 할 일",
    `- 제목: ${task.title}`,
    `- 상태/우선순위: ${task.status}/${task.priority}`,
    `- 기한: ${task.due_date || "없음"}`,
    `- 사업: ${venture ? venture.name : "미지정"}`,
    `- 설명: ${task.description || "(없음)"}`,
    task.checklist.length
      ? `- 체크리스트:\n${task.checklist.map((c) => `  - [${c.done ? "x" : " "}] ${c.text}`).join("\n")}`
      : "- 체크리스트: 없음",
    comments.length
      ? `- 코멘트:\n${comments.map((c) => `  - [${c.author === "user" ? "사용자" : "비서"}] ${clip(c.body, 300)}`).join("\n")}`
      : "- 코멘트: 없음",
    "",
    "이 할 일을 빠르고 확실하게 끝내기 위한 비서의 코멘트를 작성하세요. 구체적인 다음 행동, 빠진 것, 리스크, 필요하면 쪼갤 하위 단계. 250자 내외, 마크다운 불릿 허용.",
  ].join("\n");
  return textCompletion(input.context.userName, user, "medium");
}
