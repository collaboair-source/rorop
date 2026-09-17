"use client";

// /hq — 사령부 (command center): one overview fetch, quick task capture, today's briefing.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useHqUser } from "@/components/hq/HqUserContext";
import TaskItem from "@/components/hq/TaskItem";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingBlock,
  PageHeader,
  PriorityBadge,
  RichText,
  Select,
  StatTile,
  VentureStatusBadge,
  cx,
} from "@/components/hq/ui";
import type { Briefing, CommentWithTarget, OverviewResponse, Priority, TaskWithVenture, VentureWithStats } from "@/lib/hq/types";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/hq/types";
import { daysUntil, formatDateTime, localDateKey, relativeTime, truncate } from "@/lib/hq/format";

type TaskLists = OverviewResponse["tasks"];
type ListKey = keyof TaskLists;
type Stats = OverviewResponse["stats"];

const LIST_KEYS: ListKey[] = ["overdue", "today", "doing", "unscheduled_urgent", "upcoming"];

const SECTIONS: { key: ListKey; label: string; labelClass: string }[] = [
  { key: "overdue", label: "기한 지남", labelClass: "text-red-600" },
  { key: "today", label: "오늘", labelClass: "text-amber-700" },
  { key: "doing", label: "진행 중", labelClass: "text-indigo-600" },
  { key: "unscheduled_urgent", label: "기한 없는 긴급", labelClass: "text-orange-600" },
  { key: "upcoming", label: "다음 7일", labelClass: "text-gray-600" },
];

const AI_OFF_COPY = "AI 비서가 꺼져 있습니다. ANTHROPIC_API_KEY를 설정하세요.";
const VENTURE_PREVIEW = 6;

function greetingDate(now = new Date()): string {
  return now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    return typeof data.error === "string" && data.error ? data.error : fallback;
  } catch {
    return fallback;
  }
}

function targetHref(c: CommentWithTarget): string {
  if (c.target_type === "venture") return `/hq/ventures/${c.target_id}`;
  if (c.target_type === "task") return `/hq/tasks/${c.target_id}`;
  return `/hq/knowledge/${c.target_id}`;
}

function targetGlyph(c: CommentWithTarget): string {
  if (c.target_type === "venture") return "▣";
  if (c.target_type === "task") return "☑";
  return "⇩";
}

function isOverdue(t: TaskWithVenture, today: string): boolean {
  return t.status !== "done" && !!t.due_date && t.due_date < today;
}

/** Keep the stat tiles roughly in sync with a local status change without a refetch. */
function statsAfterChange(stats: Stats, before: TaskWithVenture, after: TaskWithVenture, today: string): Stats {
  const wasDone = before.status === "done" ? 1 : 0;
  const isDone = after.status === "done" ? 1 : 0;
  const wasDoing = before.status === "doing" ? 1 : 0;
  const isDoing = after.status === "doing" ? 1 : 0;
  const wasOverdue = isOverdue(before, today) ? 1 : 0;
  const nowOverdue = isOverdue(after, today) ? 1 : 0;
  const clamp = (n: number) => Math.max(0, n);
  return {
    ...stats,
    open_tasks: clamp(stats.open_tasks + wasDone - isDone),
    doing_tasks: clamp(stats.doing_tasks + isDoing - wasDoing),
    overdue_tasks: clamp(stats.overdue_tasks + nowOverdue - wasOverdue),
    done_this_week: clamp(stats.done_this_week + isDone - wasDone),
  };
}

/** Put a freshly created task into the focus bucket it belongs to. Returns null when it falls outside today's focus. */
function bucketFor(task: TaskWithVenture, today: string): ListKey | null {
  if (task.due_date === today) return "today";
  const n = daysUntil(task.due_date, today);
  if (n !== null && n < 0) return "overdue";
  if (n !== null && n > 0 && n <= 7) return "upcoming";
  if (!task.due_date && (task.priority === "P0" || task.priority === "P1")) return "unscheduled_urgent";
  return null;
}

export default function HqCommandCenterPage() {
  const user = useHqUser();
  const today = localDateKey();

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [briefError, setBriefError] = useState("");

  // State updates happen only inside promise callbacks so this is safe to call from effects and handlers.
  const load = useCallback(
    () =>
      fetch("/api/hq/overview", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error(await readError(res, "현황을 불러오지 못했습니다"));
          const body = (await res.json()) as OverviewResponse;
          setData(body);
          setLoadError("");
        })
        .catch((err: unknown) => setLoadError(errorMessage(err, "현황을 불러오지 못했습니다")))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const aiEnabled = data?.ai_enabled ?? false;

  async function generateBriefing() {
    if (!aiEnabled || generating) return;
    setGenerating(true);
    setBriefError("");
    try {
      const res = await fetch("/api/hq/secretary/briefing", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "브리핑을 생성하지 못했습니다"));
      const body = (await res.json()) as { briefing: Briefing };
      setData((prev) => (prev ? { ...prev, briefing: body.briefing } : prev));
      void load();
    } catch (err) {
      setBriefError(errorMessage(err, "브리핑을 생성하지 못했습니다"));
    } finally {
      setGenerating(false);
    }
  }

  function updateTask(next: TaskWithVenture) {
    setData((prev) => {
      if (!prev) return prev;
      let before: TaskWithVenture | undefined;
      const tasks = { ...prev.tasks };
      for (const key of LIST_KEYS) {
        tasks[key] = prev.tasks[key].map((t) => {
          if (t.id !== next.id) return t;
          before = before ?? t;
          return next;
        });
      }
      return { ...prev, tasks, stats: before ? statsAfterChange(prev.stats, before, next, today) : prev.stats };
    });
  }

  function addTask(task: TaskWithVenture): ListKey | null {
    const bucket = bucketFor(task, today);
    setData((prev) => {
      if (!prev) return prev;
      const tasks = bucket ? { ...prev.tasks, [bucket]: [task, ...prev.tasks[bucket]] } : prev.tasks;
      return {
        ...prev,
        tasks,
        stats: {
          ...prev.stats,
          open_tasks: prev.stats.open_tasks + 1,
          overdue_tasks: prev.stats.overdue_tasks + (bucket === "overdue" ? 1 : 0),
        },
      };
    });
    return bucket;
  }

  const sections = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return SECTIONS.map((s) => ({
      ...s,
      tasks: data.tasks[s.key].filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      }),
    })).filter((s) => s.tasks.length > 0);
  }, [data]);

  const subtitle = !data
    ? "오늘의 현황을 불러오는 중입니다."
    : data.stats.overdue_tasks > 0
    ? `기한 지난 할 일 ${data.stats.overdue_tasks}개부터 정리하세요.`
    : data.stats.open_tasks > 0
    ? `열린 할 일 ${data.stats.open_tasks}개. 오늘 집중할 것부터 처리하세요.`
    : "열린 할 일이 없습니다. 새 할 일을 추가하거나 Claude 자료를 가져오세요.";

  const generateButton = (label: string, variant: "primary" | "ghost" = "primary") => (
    <span title={aiEnabled ? undefined : AI_OFF_COPY} className="inline-flex">
      <Button variant={variant} size={variant === "ghost" ? "sm" : "md"} onClick={generateBriefing} loading={generating} disabled={!aiEnabled || !data}>
        {label}
      </Button>
    </span>
  );

  return (
    <div>
      <PageHeader title={`${user.name}님, ${greetingDate()}`} subtitle={subtitle} actions={generateButton("✦ 오늘의 브리핑 생성")} />

      {loading && !data ? (
        <LoadingBlock label="현황을 불러오는 중..." />
      ) : !data ? (
        <div>
          <ErrorBanner message={loadError || "현황을 불러오지 못했습니다"} />
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setLoadError("");
              void load();
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <ErrorBanner message={loadError} onClose={() => setLoadError("")} />

          {/* 2. Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile label="열린 할 일" value={data.stats.open_tasks} href="/hq/tasks?status=open" />
            <StatTile label="진행 중" value={data.stats.doing_tasks} tone="accent" href="/hq/tasks?status=doing" />
            <StatTile label="기한 지남" value={data.stats.overdue_tasks} tone={data.stats.overdue_tasks > 0 ? "danger" : "default"} href="/hq/tasks?status=open" />
            <StatTile label="이번 주 완료" value={data.stats.done_this_week} tone="success" href="/hq/tasks?status=done" />
            <StatTile
              label="진행 중 사업 / 전체"
              value={
                <>
                  {data.stats.ventures_active}
                  <span className="text-gray-400 text-base font-medium"> / {data.stats.ventures_total}</span>
                </>
              }
              href="/hq/ventures"
            />
            <StatTile label="미분석 자료" value={data.stats.knowledge_unanalyzed} tone={data.stats.knowledge_unanalyzed > 0 ? "accent" : "default"} href="/hq/import" />
          </div>

          {/* 3. Today's briefing */}
          <Card
            title="✦ 오늘의 브리핑"
            actions={
              data.briefing ? (
                <>
                  <span className="hidden sm:inline text-xs text-gray-400">{formatDateTime(data.briefing.created_at)} 생성</span>
                  {generateButton("다시 생성", "ghost")}
                </>
              ) : undefined
            }
          >
            <ErrorBanner message={briefError} onClose={() => setBriefError("")} />
            {!aiEnabled && (
              <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">{AI_OFF_COPY}</p>
            )}
            {data.briefing ? (
              <>
                <RichText text={data.briefing.content} />
                <p className="sm:hidden text-xs text-gray-400 mt-3">{formatDateTime(data.briefing.created_at)} 생성</p>
              </>
            ) : (
              <EmptyState
                title="아직 오늘의 브리핑이 없습니다"
                hint="비서가 기한, 우선순위, 사업 현황을 종합해 오늘 처리할 순서를 제안합니다."
                action={aiEnabled ? generateButton("✦ 오늘의 브리핑 생성") : undefined}
              />
            )}
          </Card>

          {/* 4. Focus + ventures/comments */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="오늘 집중" actions={<Link href="/hq/tasks" className="text-xs text-gray-500 hover:text-indigo-600">전체 할 일 →</Link>}>
                <QuickAdd today={today} onAdded={addTask} />
                {sections.length === 0 ? (
                  <EmptyState
                    title="오늘 잡힌 할 일이 없습니다"
                    hint="위에서 바로 추가하거나 할 일 목록에서 기한을 잡으세요."
                    action={
                      <Link href="/hq/tasks" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        할 일 목록 열기
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-5">
                    {sections.map((s) => (
                      <section key={s.key}>
                        <h3 className={cx("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2", s.labelClass)}>
                          {s.label}
                          <span className="text-gray-400 font-normal normal-case">{s.tasks.length}</span>
                        </h3>
                        <ul className="space-y-1.5">
                          {s.tasks.map((t) => (
                            <li key={t.id}>
                              <TaskItem task={t} compact onChange={updateTask} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <VentureList ventures={data.ventures} />
              <RecentComments comments={data.recent_comments} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 5. Quick add ----------

function QuickAdd({ today, onAdded }: { today: string; onAdded: (task: TaskWithVenture) => ListKey | null }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("P2");
  const [due, setDue] = useState(today);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/hq/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, priority, due_date: due || undefined }),
      });
      if (!res.ok) throw new Error(await readError(res, "할 일을 추가하지 못했습니다"));
      const body = (await res.json()) as { task: TaskWithVenture };
      const bucket = onAdded(body.task);
      if (!bucket) setNotice(`"${truncate(body.task.title, 30)}" 추가됨. 오늘 집중 범위 밖이라 할 일 목록에서 확인하세요.`);
      setTitle("");
      setPriority("P2");
      setDue(today);
    } catch (err) {
      setError(errorMessage(err, "할 일을 추가하지 못했습니다"));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mb-5">
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="지금 바로 잡을 할 일"
          aria-label="할 일 제목"
          disabled={adding}
          className="sm:flex-1"
        />
        <div className="flex gap-2">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="우선순위" disabled={adding} className="w-auto shrink-0">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} · {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="기한" disabled={adding} className="min-w-0 flex-1 sm:w-40 sm:flex-none" />
          <Button type="submit" loading={adding} disabled={!title.trim()} className="shrink-0">
            추가
          </Button>
        </div>
      </form>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} onClose={() => setError("")} />
        </div>
      )}
      {notice && (
        <p className="mt-2 text-xs text-gray-500">
          {notice}{" "}
          <Link href="/hq/tasks" className="text-indigo-600 hover:underline">
            할 일 목록 →
          </Link>
        </p>
      )}
    </div>
  );
}

// ---------- 4R. Ventures ----------

function VentureList({ ventures }: { ventures: VentureWithStats[] }) {
  const shown = ventures.slice(0, VENTURE_PREVIEW);
  const rest = ventures.length - shown.length;
  return (
    <Card
      title="▣ 사업 현황"
      actions={
        <Link href="/hq/ventures" className="text-xs text-gray-500 hover:text-indigo-600">
          {rest > 0 ? `${rest}개 더 보기 →` : "전체 보기 →"}
        </Link>
      }
    >
      {ventures.length === 0 ? (
        <EmptyState
          title="등록된 사업이 없습니다"
          hint="사업을 만들거나 Claude 자료를 가져와 정리하세요."
          action={
            <Link href="/hq/ventures" className="text-sm font-medium text-indigo-600 hover:underline">
              사업 만들기 →
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map((v) => {
            const pct = v.task_total ? Math.round((v.task_done / v.task_total) * 100) : 0;
            return (
              <li key={v.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/hq/ventures/${v.id}`} className="min-w-0 truncate text-sm font-medium text-gray-900 hover:text-indigo-600">
                    {v.name}
                  </Link>
                  <span className={cx("shrink-0 text-xs tabular-nums", v.task_open > 0 ? "text-gray-600" : "text-gray-400")}>{v.task_open}개 남음</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <VentureStatusBadge status={v.status} />
                  <PriorityBadge priority={v.priority} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className={cx("h-full rounded-full transition-all", pct === 100 ? "bg-green-500" : "bg-indigo-500")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                    {v.task_done}/{v.task_total}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- 4R. Recent comments ----------

function RecentComments({ comments }: { comments: CommentWithTarget[] }) {
  return (
    <Card title="최근 코멘트">
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">아직 코멘트가 없습니다. 사업이나 할 일에 진행 상황을 남기세요.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {comments.map((c) => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={cx("font-semibold", c.author === "secretary" ? "text-indigo-700" : "text-gray-700")}>{c.author === "secretary" ? "✦ 비서" : "나"}</span>
                <span className="text-gray-400 shrink-0">{relativeTime(c.created_at)}</span>
              </div>
              <Link href={targetHref(c)} className="mt-0.5 block truncate text-xs text-gray-500 hover:text-indigo-600">
                {targetGlyph(c)} {c.target_title}
              </Link>
              <p className="mt-1 text-sm text-gray-800 leading-snug">{truncate(c.body.replace(/\*\*/g, ""), 120)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
