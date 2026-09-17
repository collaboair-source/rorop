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
  Priority,
  SourceKind,
  ChecklistItem,
  VentureStatus,
  TaskStatus,
} from "./types";
import type { SecretaryContext } from "./secretary";

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
  store.ventures = store.ventures.filter((v) => v.id !== id);
  for (const t of store.tasks) if (t.user_id === userId && t.venture_id === id) t.venture_id = null;
  for (const k of store.knowledge) if (k.user_id === userId && k.venture_id === id) k.venture_id = null;
  store.comments = store.comments.filter((c) => !(c.target_type === "venture" && c.target_id === id));
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
  store.tasks = store.tasks.filter((t) => t.id !== id);
  store.comments = store.comments.filter((c) => !(c.target_type === "task" && c.target_id === id));
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
  store.knowledge = store.knowledge.filter((k) => k.id !== id);
  store.comments = store.comments.filter((c) => !(c.target_type === "knowledge" && c.target_id === id));
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
