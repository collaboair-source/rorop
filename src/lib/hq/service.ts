// Domain operations shared by the HQ API routes. Every function works on the
// persisted store and scopes data by user id.
import { getStore, persist } from "@/lib/db";
import type { User } from "@/lib/db";
import { ApiError, newId, nowIso, addDays } from "./api";
import type {
  Venture,
  VentureWithStats,
  Task,
  TaskWithVenture,
  Comment,
  CommentWithTarget,
  CommentTarget,
  KnowledgeItem,
  KnowledgeListItem,
  SecretaryMessage,
  Briefing,
  SearchHit,
  SearchHitKind,
  SearchResponse,
  BackupFile,
  BackupSummary,
  Priority,
  SourceKind,
  ChecklistItem,
  VentureStatus,
  TaskStatus,
} from "./types";
import type { SecretaryContext } from "./secretary";
import { normalizeQuery, snippetAround, scoreFields, MAX_SCAN_CHARS } from "./search";
import { VENTURE_STATUS_LABEL, TASK_STATUS_LABEL, PRIORITY_LABEL, PRIORITIES, TASK_STATUSES, VENTURE_STATUSES } from "./types";

// ---------- ventures ----------

export function listVentures(userId: string): Venture[] {
  return getStore().ventures.filter((v) => v.user_id === userId);
}

export function getVenture(userId: string, id: string): Venture {
  const v = getStore().ventures.find((x) => x.id === id && x.user_id === userId);
  if (!v) throw new ApiError(404, "사업을 찾을 수 없습니다");
  return v;
}

export function ventureStats(userId: string, venture: Venture): VentureWithStats {
  const tasks = getStore().tasks.filter((t) => t.user_id === userId && t.venture_id === venture.id);
  const done = tasks.filter((t) => t.status === "done").length;
  return { ...venture, task_total: tasks.length, task_done: done, task_open: tasks.length - done };
}

export interface NewVentureInput {
  name: string;
  summary?: string;
  status?: VentureStatus;
  priority?: Priority;
  goal?: string;
  tags?: string[];
  source?: SourceKind;
  source_ref?: string | null;
}

export function createVenture(userId: string, input: NewVentureInput): Venture {
  const ts = nowIso();
  const venture: Venture = {
    id: newId(),
    user_id: userId,
    name: input.name.trim(),
    summary: (input.summary || "").trim(),
    status: input.status || "active",
    priority: input.priority || "P2",
    goal: (input.goal || "").trim(),
    tags: input.tags || [],
    source: input.source || "manual",
    source_ref: input.source_ref ?? null,
    created_at: ts,
    updated_at: ts,
  };
  getStore().ventures.push(venture);
  persist();
  return venture;
}

/** Case-insensitive name match for de-duplicating AI-created ventures. */
export function findVentureByName(userId: string, name: string): Venture | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return listVentures(userId).find((v) => v.name.trim().toLowerCase() === key);
}

export function deleteVenture(userId: string, id: string): void {
  const store = getStore();
  getVenture(userId, id);
  store.ventures = store.ventures.filter((v) => !(v.id === id && v.user_id === userId));
  for (const t of store.tasks) if (t.user_id === userId && t.venture_id === id) t.venture_id = null;
  for (const k of store.knowledge) if (k.user_id === userId && k.venture_id === id) k.venture_id = null;
  store.comments = store.comments.filter((c) => !(c.user_id === userId && c.target_type === "venture" && c.target_id === id));
  persist();
}

// ---------- tasks ----------

export function listTasks(userId: string): Task[] {
  return getStore().tasks.filter((t) => t.user_id === userId);
}

export function getTask(userId: string, id: string): Task {
  const t = getStore().tasks.find((x) => x.id === id && x.user_id === userId);
  if (!t) throw new ApiError(404, "할 일을 찾을 수 없습니다");
  return t;
}

export function withVenture(userId: string, task: Task): TaskWithVenture {
  const v = task.venture_id ? getStore().ventures.find((x) => x.id === task.venture_id && x.user_id === userId) : undefined;
  return { ...task, venture_name: v ? v.name : null };
}

export interface NewTaskInput {
  title: string;
  venture_id?: string | null;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  due_date?: string | null;
  checklist?: ChecklistItem[];
  tags?: string[];
  source?: SourceKind;
  source_ref?: string | null;
}

export function createTask(userId: string, input: NewTaskInput): Task {
  if (input.venture_id) getVenture(userId, input.venture_id);
  const ts = nowIso();
  const task: Task = {
    id: newId(),
    user_id: userId,
    venture_id: input.venture_id || null,
    title: input.title.trim(),
    description: (input.description || "").trim(),
    status: input.status || "todo",
    priority: input.priority || "P2",
    due_date: input.due_date ?? null,
    checklist: input.checklist || [],
    tags: input.tags || [],
    source: input.source || "manual",
    source_ref: input.source_ref ?? null,
    created_at: ts,
    updated_at: ts,
    completed_at: input.status === "done" ? ts : null,
  };
  getStore().tasks.push(task);
  persist();
  return task;
}

export function deleteTask(userId: string, id: string): void {
  const store = getStore();
  getTask(userId, id);
  store.tasks = store.tasks.filter((t) => !(t.id === id && t.user_id === userId));
  store.comments = store.comments.filter((c) => !(c.user_id === userId && c.target_type === "task" && c.target_id === id));
  persist();
}

const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/** Default ordering: open before done, due date ascending (null last), priority, newest. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.status === "done" ? 1 : 0;
    const bd = b.status === "done" ? 1 : 0;
    if (ad !== bd) return ad - bd;
    if (ad === 1) return (b.completed_at || "").localeCompare(a.completed_at || "");
    const da = a.due_date || "9999-99-99";
    const db = b.due_date || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ---------- comments ----------

export function targetTitle(userId: string, type: CommentTarget, id: string): string {
  const store = getStore();
  if (type === "venture") return store.ventures.find((v) => v.id === id && v.user_id === userId)?.name || "(삭제된 사업)";
  if (type === "task") return store.tasks.find((t) => t.id === id && t.user_id === userId)?.title || "(삭제된 할 일)";
  return store.knowledge.find((k) => k.id === id && k.user_id === userId)?.title || "(삭제된 자료)";
}

export function assertTargetExists(userId: string, type: CommentTarget, id: string): void {
  const store = getStore();
  const exists =
    type === "venture"
      ? store.ventures.some((v) => v.id === id && v.user_id === userId)
      : type === "task"
      ? store.tasks.some((t) => t.id === id && t.user_id === userId)
      : store.knowledge.some((k) => k.id === id && k.user_id === userId);
  if (!exists) throw new ApiError(404, "코멘트 대상을 찾을 수 없습니다");
}

export function listComments(userId: string, type: CommentTarget, id: string): Comment[] {
  return getStore()
    .comments.filter((c) => c.user_id === userId && c.target_type === type && c.target_id === id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function addComment(userId: string, type: CommentTarget, id: string, author: "user" | "secretary", body: string): Comment {
  assertTargetExists(userId, type, id);
  const comment: Comment = {
    id: newId(),
    user_id: userId,
    target_type: type,
    target_id: id,
    author,
    body: body.trim(),
    created_at: nowIso(),
  };
  getStore().comments.push(comment);
  persist();
  return comment;
}

export function recentComments(userId: string, limit = 10): CommentWithTarget[] {
  return getStore()
    .comments.filter((c) => c.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((c) => ({ ...c, target_title: targetTitle(userId, c.target_type, c.target_id) }));
}

// ---------- knowledge ----------

export function listKnowledge(userId: string): KnowledgeItem[] {
  return getStore().knowledge.filter((k) => k.user_id === userId);
}

export function getKnowledge(userId: string, id: string): KnowledgeItem {
  const k = getStore().knowledge.find((x) => x.id === id && x.user_id === userId);
  if (!k) throw new ApiError(404, "자료를 찾을 수 없습니다");
  return k;
}

export function knowledgeListItem(userId: string, item: KnowledgeItem): KnowledgeListItem {
  const store = getStore();
  const { content, ...rest } = item;
  const venture = item.venture_id ? store.ventures.find((v) => v.id === item.venture_id && v.user_id === userId) : undefined;
  const task_count = store.tasks.filter((t) => t.user_id === userId && t.source_ref === item.id).length;
  return { ...rest, content_length: content.length, venture_name: venture ? venture.name : null, task_count };
}

export function deleteKnowledge(userId: string, id: string): void {
  const store = getStore();
  getKnowledge(userId, id);
  store.knowledge = store.knowledge.filter((k) => !(k.id === id && k.user_id === userId));
  store.comments = store.comments.filter((c) => !(c.user_id === userId && c.target_type === "knowledge" && c.target_id === id));
  // tasks created from this item stay; they just lose the back-link
  for (const t of store.tasks) if (t.user_id === userId && t.source_ref === id) t.source_ref = null;
  persist();
}

// ---------- secretary context ----------

export function buildSecretaryContext(user: User, today: string): SecretaryContext {
  const userId = user.id;
  const comments = getStore()
    .comments.filter((c) => c.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);
  const knowledge = listKnowledge(userId)
    .sort((a, b) => (b.source_date || b.created_at).localeCompare(a.source_date || a.created_at))
    .slice(0, 25)
    .map((k) => ({
      title: k.title,
      kind: k.kind,
      venture_id: k.venture_id,
      summary: k.analyzed ? k.summary : "",
      insights: k.analysis ? k.analysis.insights : [],
      source_date: k.source_date,
      analyzed: k.analyzed,
    }));
  return {
    userName: user.name,
    today,
    ventures: listVentures(userId),
    tasks: listTasks(userId),
    recentComments: comments,
    knowledge,
  };
}

// ---------- overview ----------

/** Buckets are disjoint: each task lands in the first matching bucket, in this order. */
export function overviewTasks(userId: string, today: string) {
  const horizon = addDays(today, 7);
  const open = sortTasks(listTasks(userId).filter((t) => t.status !== "done"));
  const wrap = (ts: Task[]) => ts.map((t) => withVenture(userId, t));
  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const doing: Task[] = [];
  const unscheduledUrgent: Task[] = [];
  const upcoming: Task[] = [];
  for (const t of open) {
    if (t.due_date && t.due_date < today) overdue.push(t);
    else if (t.due_date === today) todayTasks.push(t);
    else if (t.status === "doing") doing.push(t);
    else if (!t.due_date && (t.priority === "P0" || t.priority === "P1")) unscheduledUrgent.push(t);
    else if (t.due_date && t.due_date > today && t.due_date <= horizon) upcoming.push(t);
  }
  return {
    today,
    overdue: wrap(overdue),
    today_tasks: wrap(todayTasks),
    doing: wrap(doing),
    upcoming: wrap(upcoming),
    unscheduled_urgent: wrap(unscheduledUrgent),
    open,
  };
}

// ---------- search ----------

const SEARCH_LIMIT = 60;

export function searchAll(userId: string, q: string): SearchResponse {
  const tokens = normalizeQuery(q);
  const counts: Record<SearchHitKind, number> = { venture: 0, task: 0, knowledge: 0, comment: 0 };
  if (!tokens.length) return { q, hits: [], counts, truncated: false };
  const store = getStore();
  const hits: SearchHit[] = [];
  const ventureName = (id: string | null) => (id ? store.ventures.find((v) => v.id === id && v.user_id === userId)?.name || "" : "");

  for (const v of store.ventures) {
    if (v.user_id !== userId) continue;
    const score = scoreFields(tokens, [
      { text: v.name, weight: 4 },
      { text: v.tags.join(" "), weight: 2.5 },
      { text: v.goal, weight: 2 },
      { text: v.summary, weight: 1.5 },
    ]);
    if (!score) continue;
    counts.venture++;
    hits.push({
      kind: "venture",
      id: v.id,
      title: v.name,
      snippet: snippetAround([v.goal, v.summary].filter(Boolean).join(" · "), tokens),
      href: `/hq/ventures/${v.id}`,
      score: score + 0.5,
      meta: `${VENTURE_STATUS_LABEL[v.status]} · ${v.priority} · ${PRIORITY_LABEL[v.priority]}`,
      updated_at: v.updated_at,
    });
  }
  for (const t of store.tasks) {
    if (t.user_id !== userId) continue;
    const score = scoreFields(tokens, [
      { text: t.title, weight: 4 },
      { text: t.tags.join(" "), weight: 2.5 },
      { text: t.checklist.map((c) => c.text).join(" "), weight: 2 },
      { text: t.description, weight: 1.5 },
    ]);
    if (!score) continue;
    counts.task++;
    const vn = ventureName(t.venture_id);
    hits.push({
      kind: "task",
      id: t.id,
      title: t.title,
      snippet: snippetAround([t.description, ...t.checklist.map((c) => c.text)].filter(Boolean).join(" · "), tokens),
      href: `/hq/tasks/${t.id}`,
      score: score + (t.status === "done" ? -0.5 : 0.25),
      meta: [TASK_STATUS_LABEL[t.status], `${t.priority} · ${PRIORITY_LABEL[t.priority]}`, vn].filter(Boolean).join(" · "),
      updated_at: t.updated_at,
    });
  }
  for (const k of store.knowledge) {
    if (k.user_id !== userId) continue;
    const insights = k.analysis ? k.analysis.insights.join(" ") : "";
    const score = scoreFields(tokens, [
      { text: k.title, weight: 3.5 },
      { text: k.summary, weight: 2 },
      { text: insights, weight: 1.5 },
      { text: k.content, weight: 1 },
    ]);
    if (!score) continue;
    counts.knowledge++;
    const body = [k.summary, insights, k.content.slice(0, MAX_SCAN_CHARS)].filter(Boolean).join(" · ");
    hits.push({
      kind: "knowledge",
      id: k.id,
      title: k.title,
      snippet: snippetAround(body, tokens),
      href: `/hq/knowledge/${k.id}`,
      score,
      meta: [k.kind === "conversation" ? "대화" : k.kind === "project" ? "프로젝트" : "메모", k.analyzed ? "분석 완료" : "미분석", ventureName(k.venture_id)].filter(Boolean).join(" · "),
      updated_at: k.source_date || k.created_at,
    });
  }
  for (const c of store.comments) {
    if (c.user_id !== userId) continue;
    const score = scoreFields(tokens, [{ text: c.body, weight: 1.5 }]);
    if (!score) continue;
    counts.comment++;
    const title = targetTitle(userId, c.target_type, c.target_id);
    const href = c.target_type === "venture" ? `/hq/ventures/${c.target_id}` : c.target_type === "task" ? `/hq/tasks/${c.target_id}` : `/hq/knowledge/${c.target_id}`;
    hits.push({
      kind: "comment",
      id: c.id,
      title,
      snippet: snippetAround(c.body, tokens),
      href,
      score,
      meta: `${c.author === "secretary" ? "비서" : "나"} 코멘트 · ${c.created_at.slice(0, 10)}`,
      updated_at: c.created_at,
    });
  }
  hits.sort((a, b) => b.score - a.score || b.updated_at.localeCompare(a.updated_at));
  const truncated = hits.length > SEARCH_LIMIT;
  return { q, hits: hits.slice(0, SEARCH_LIMIT), counts, truncated };
}

// ---------- backup / restore ----------

export function exportBackup(user: User): BackupFile {
  const store = getStore();
  const mine = <T extends { user_id: string }>(rows: T[]) => rows.filter((r) => r.user_id === user.id);
  return {
    format: "rorop-hq-backup",
    version: 1,
    exported_at: nowIso(),
    user: { email: user.email, name: user.name },
    data: {
      ventures: mine(store.ventures),
      tasks: mine(store.tasks),
      comments: mine(store.comments),
      knowledge: mine(store.knowledge),
      secretary_messages: mine(store.secretary_messages),
      briefings: mine(store.briefings),
    },
  };
}

type BackupCollection = "ventures" | "tasks" | "comments" | "knowledge" | "secretary_messages" | "briefings";

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const s = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const sOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const iso = (v: unknown, fallback: string): string => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : fallback);
const dateKey = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const bad = (collection: string, index: number, why: string) => new ApiError(400, `백업의 ${collection}[${index}] 항목이 올바르지 않습니다: ${why}`);

/**
 * Validate a backup payload and normalize every row to the current record shape
 * (unknown fields dropped, enums checked, dates verified). Throws ApiError(400).
 */
export function parseBackup(payload: unknown): BackupFile {
  if (!isRow(payload)) throw new ApiError(400, "백업 파일 형식이 아닙니다");
  if (payload.format !== "rorop-hq-backup") throw new ApiError(400, "Rorop HQ 백업 파일이 아닙니다 (format 불일치)");
  if (payload.version !== 1) throw new ApiError(400, `지원하지 않는 백업 버전입니다: ${String(payload.version)}`);
  if (!isRow(payload.data)) throw new ApiError(400, "백업에 data가 없습니다");
  const data = payload.data;
  const rows = (key: BackupCollection): Row[] => {
    const v = data[key] === undefined ? [] : data[key];
    if (!Array.isArray(v)) throw new ApiError(400, `백업의 ${key} 항목이 배열이 아닙니다`);
    return v.map((r, i) => {
      if (!isRow(r) || typeof r.id !== "string" || !r.id) throw bad(key, i, "id 없음");
      return r;
    });
  };
  const now = nowIso();
  const user = isRow(payload.user) ? payload.user : {};

  const ventures: Venture[] = rows("ventures").map((r, i) => {
    const name = s(r.name).trim();
    if (!name) throw bad("ventures", i, "name 없음");
    const created = iso(r.created_at, now);
    return {
      id: r.id as string,
      user_id: "",
      name,
      summary: s(r.summary),
      status: VENTURE_STATUSES.includes(r.status as VentureStatus) ? (r.status as VentureStatus) : "active",
      priority: PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : "P2",
      goal: s(r.goal),
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      source: r.source === "claude" || r.source === "secretary" ? r.source : "manual",
      source_ref: sOrNull(r.source_ref),
      created_at: created,
      updated_at: iso(r.updated_at, created),
    };
  });
  const tasks: Task[] = rows("tasks").map((r, i) => {
    const title = s(r.title).trim();
    if (!title) throw bad("tasks", i, "title 없음");
    const created = iso(r.created_at, now);
    const status = TASK_STATUSES.includes(r.status as TaskStatus) ? (r.status as TaskStatus) : "todo";
    return {
      id: r.id as string,
      user_id: "",
      venture_id: sOrNull(r.venture_id),
      title,
      description: s(r.description),
      status,
      priority: PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : "P2",
      due_date: dateKey(r.due_date),
      checklist: Array.isArray(r.checklist)
        ? r.checklist
            .filter(isRow)
            .filter((c) => typeof c.text === "string" && c.text.trim())
            .map((c) => ({ id: s(c.id) || newId(), text: (c.text as string).trim(), done: c.done === true }))
        : [],
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      source: r.source === "claude" || r.source === "secretary" ? r.source : "manual",
      source_ref: sOrNull(r.source_ref),
      created_at: created,
      updated_at: iso(r.updated_at, created),
      completed_at: status === "done" ? iso(r.completed_at, created) : null,
    };
  });
  const comments: Comment[] = rows("comments").map((r, i) => {
    const body = s(r.body).trim();
    if (!body) throw bad("comments", i, "body 없음");
    const type = r.target_type;
    if (type !== "venture" && type !== "task" && type !== "knowledge") throw bad("comments", i, "target_type 불명");
    if (typeof r.target_id !== "string" || !r.target_id) throw bad("comments", i, "target_id 없음");
    return {
      id: r.id as string,
      user_id: "",
      target_type: type,
      target_id: r.target_id,
      author: r.author === "secretary" ? "secretary" : "user",
      body,
      created_at: iso(r.created_at, now),
    };
  });
  const knowledge: KnowledgeItem[] = rows("knowledge").map((r, i) => {
    const content = s(r.content);
    if (!content.trim()) throw bad("knowledge", i, "content 없음");
    const analysis = isRow(r.analysis) ? r.analysis : null;
    return {
      id: r.id as string,
      user_id: "",
      kind: r.kind === "conversation" || r.kind === "project" ? r.kind : "note",
      title: s(r.title).trim() || content.split("\n")[0].slice(0, 80) || "제목 없음",
      content,
      source_uuid: sOrNull(r.source_uuid),
      source_date: sOrNull(r.source_date),
      venture_id: sOrNull(r.venture_id),
      summary: s(r.summary),
      analyzed: r.analyzed === true,
      analysis: analysis
        ? {
            summary: s(analysis.summary),
            venture: isRow(analysis.venture)
              ? { name: s(analysis.venture.name), summary: s(analysis.venture.summary), match_existing_id: sOrNull(analysis.venture.match_existing_id) }
              : { name: "", summary: "", match_existing_id: null },
            tasks: Array.isArray(analysis.tasks)
              ? analysis.tasks.filter(isRow).map((t) => ({
                  title: s(t.title),
                  description: s(t.description),
                  priority: PRIORITIES.includes(t.priority as Priority) ? (t.priority as Priority) : "P2",
                  due_date: dateKey(t.due_date),
                }))
              : [],
            insights: Array.isArray(analysis.insights) ? analysis.insights.filter((x): x is string => typeof x === "string") : [],
            analyzed_at: iso(analysis.analyzed_at, now),
          }
        : null,
      created_at: iso(r.created_at, now),
    };
  });
  const secretary_messages: SecretaryMessage[] = rows("secretary_messages").map((r) => ({
    id: r.id as string,
    user_id: "",
    role: r.role === "secretary" ? "secretary" : "user",
    content: s(r.content),
    proposals: Array.isArray(r.proposals)
      ? r.proposals.filter(isRow).map((p) => ({
          kind: "task" as const,
          title: s(p.title),
          description: s(p.description),
          priority: PRIORITIES.includes(p.priority as Priority) ? (p.priority as Priority) : "P2",
          due_date: dateKey(p.due_date),
          venture_id: sOrNull(p.venture_id),
          venture_name: sOrNull(p.venture_name),
          accepted: p.accepted === true,
          task_id: sOrNull(p.task_id),
        }))
      : [],
    created_at: iso(r.created_at, now),
  }));
  const briefings: Briefing[] = rows("briefings").map((r, i) => {
    const date = dateKey(r.date);
    if (!date) throw bad("briefings", i, "date 형식");
    return {
      id: r.id as string,
      user_id: "",
      date,
      kind: r.kind === "weekly" ? "weekly" : "daily",
      content: s(r.content),
      created_at: iso(r.created_at, now),
    };
  });

  return {
    format: "rorop-hq-backup",
    version: 1,
    exported_at: iso(payload.exported_at, now),
    user: { email: s(user.email), name: s(user.name) },
    data: { ventures, tasks, comments, knowledge, secretary_messages, briefings },
  };
}

/**
 * Replace every HQ record of this user with the backup's. Every record gets a
 * fresh id (so a file exported elsewhere can never collide with other users'
 * records) and all references are remapped; dangling references are dropped.
 */
export function restoreBackup(user: User, backup: BackupFile): BackupSummary {
  const store = getStore();
  const d = backup.data;
  const idMap = new Map<string, string>();
  const fresh = (oldId: string): string => {
    let id = idMap.get(oldId);
    if (!id) {
      id = newId();
      idMap.set(oldId, id);
    }
    return id;
  };
  for (const rows of [d.ventures, d.tasks, d.comments, d.knowledge, d.secretary_messages, d.briefings]) for (const r of rows) fresh(r.id);
  const ref = (oldId: string | null): string | null => (oldId && idMap.has(oldId) ? idMap.get(oldId)! : null);

  const ventures: Venture[] = d.ventures.map((v) => ({ ...v, id: fresh(v.id), user_id: user.id, source_ref: ref(v.source_ref) }));
  const tasks: Task[] = d.tasks.map((t) => ({ ...t, id: fresh(t.id), user_id: user.id, venture_id: ref(t.venture_id), source_ref: ref(t.source_ref) }));
  const knowledge: KnowledgeItem[] = d.knowledge.map((k) => ({ ...k, id: fresh(k.id), user_id: user.id, venture_id: ref(k.venture_id) }));
  const targetSets = {
    venture: new Set(ventures.map((v) => v.id)),
    task: new Set(tasks.map((t) => t.id)),
    knowledge: new Set(knowledge.map((k) => k.id)),
  };
  const comments: Comment[] = d.comments
    .map((c) => ({ ...c, id: fresh(c.id), user_id: user.id, target_id: ref(c.target_id) || "" }))
    .filter((c) => c.target_id && targetSets[c.target_type].has(c.target_id));
  const secretary_messages: SecretaryMessage[] = d.secretary_messages.map((m) => ({
    ...m,
    id: fresh(m.id),
    user_id: user.id,
    proposals: m.proposals.map((p) => ({ ...p, venture_id: ref(p.venture_id), task_id: ref(p.task_id) })),
  }));
  const briefings: Briefing[] = d.briefings.map((b) => ({ ...b, id: fresh(b.id), user_id: user.id }));

  store.ventures = store.ventures.filter((r) => r.user_id !== user.id).concat(ventures);
  store.tasks = store.tasks.filter((r) => r.user_id !== user.id).concat(tasks);
  store.comments = store.comments.filter((r) => r.user_id !== user.id).concat(comments);
  store.knowledge = store.knowledge.filter((r) => r.user_id !== user.id).concat(knowledge);
  store.secretary_messages = store.secretary_messages.filter((r) => r.user_id !== user.id).concat(secretary_messages);
  store.briefings = store.briefings.filter((r) => r.user_id !== user.id).concat(briefings);
  persist();
  return {
    ventures: ventures.length,
    tasks: tasks.length,
    comments: comments.length,
    knowledge: knowledge.length,
    secretary_messages: secretary_messages.length,
    briefings: briefings.length,
  };
}

/** Venture-scoped material for the secretary's venture review. */
export function ventureReviewInput(userId: string, ventureId: string) {
  const venture = getVenture(userId, ventureId);
  const tasks = sortTasks(listTasks(userId).filter((t) => t.venture_id === ventureId));
  const comments = listComments(userId, "venture", ventureId);
  const knowledge = listKnowledge(userId)
    .filter((k) => k.venture_id === ventureId)
    .map((k) => ({ title: k.title, summary: k.analyzed ? k.summary : "", insights: k.analysis ? k.analysis.insights : [] }));
  return { venture, tasks, comments, knowledge };
}
