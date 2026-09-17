"use client";

// /hq/tasks — 할 일 목록: 검색/필터(URL 동기화), 기한별 그룹, 인라인 생성.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TaskItem from "@/components/hq/TaskItem";
import { Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingBlock, PageHeader, Select, Textarea, cx } from "@/components/hq/ui";
import type { Priority, TaskWithVenture, VentureWithStats } from "@/lib/hq/types";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/hq/types";
import { daysUntil, localDateKey } from "@/lib/hq/format";

type StatusFilter = "open" | "todo" | "doing" | "done" | "all";
type GroupKey = "overdue" | "today" | "week" | "later" | "done";

interface Filters {
  status: StatusFilter;
  venture: string; // "" = 전체, "none" = 미지정, else venture id
  priority: "" | Priority;
  q: string;
}

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "열림" },
  { value: "todo", label: "할 일" },
  { value: "doing", label: "진행 중" },
  { value: "done", label: "완료" },
  { value: "all", label: "전체" },
];

const GROUPS: { key: GroupKey; label: string; labelClass: string }[] = [
  { key: "overdue", label: "기한 지남", labelClass: "text-red-600" },
  { key: "today", label: "오늘", labelClass: "text-amber-700" },
  { key: "week", label: "이번 주", labelClass: "text-indigo-600" },
  { key: "later", label: "나중에 / 기한 없음", labelClass: "text-gray-600" },
  { key: "done", label: "완료", labelClass: "text-green-700" },
];

const DEFAULT_FILTERS: Filters = { status: "open", venture: "", priority: "", q: "" };

function isStatusFilter(v: string | null): v is StatusFilter {
  return v === "open" || v === "todo" || v === "doing" || v === "done" || v === "all";
}

function isPriority(v: string | null): v is Priority {
  return PRIORITIES.includes(v as Priority);
}

function filtersFromParams(sp: URLSearchParams): Filters {
  const status = sp.get("status");
  const priority = sp.get("priority");
  return {
    status: isStatusFilter(status) ? status : DEFAULT_FILTERS.status,
    venture: sp.get("venture_id") || "",
    priority: isPriority(priority) ? priority : "",
    q: (sp.get("q") || "").trim(),
  };
}

function paramsFromFilters(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.status !== DEFAULT_FILTERS.status) sp.set("status", f.status);
  if (f.venture) sp.set("venture_id", f.venture);
  if (f.priority) sp.set("priority", f.priority);
  if (f.q) sp.set("q", f.q);
  return sp.toString();
}

function groupOf(task: TaskWithVenture, today: string): GroupKey {
  if (task.status === "done") return "done";
  const n = daysUntil(task.due_date, today);
  if (n === null) return "later";
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  if (n <= 7) return "week";
  return "later";
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    return typeof data.error === "string" && data.error ? data.error : fallback;
  } catch {
    return fallback;
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

interface TaskResult {
  key: string;
  tasks: TaskWithVenture[];
  error: string;
}

/** Debounced search field. Uncontrolled so typing never re-renders the list; external URL changes are pushed into the DOM. */
function SearchBox({ committed, onCommit }: { committed: string; onCommit: (q: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const lastCommitted = useRef(committed);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (committed !== lastCommitted.current) {
      lastCommitted.current = committed;
      if (ref.current) ref.current.value = committed;
    }
  }, [committed]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = raw.trim();
      if (q !== lastCommitted.current) {
        lastCommitted.current = q;
        onCommit(q);
      }
    }, 300);
  }

  return <Input ref={ref} type="search" defaultValue={committed} onChange={onChange} placeholder="제목, 설명, 태그, 체크리스트 검색" aria-label="할 일 검색" />;
}

export default function TasksPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <TasksPageInner />
    </Suspense>
  );
}

function TasksPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();

  // The URL is the single source of truth for filters (back/forward and shared links just work).
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(urlKey)), [urlKey]);
  const filterKey = paramsFromFilters(filters);
  // Results remember which filter they were loaded for, so "loading" is derived rather than tracked.
  const [result, setResult] = useState<TaskResult | null>(null);
  const tasks = useMemo(() => result?.tasks ?? [], [result]);
  const loading = result?.key !== filterKey;
  const loadError = result && result.key === filterKey ? result.error : "";
  const [error, setError] = useState("");
  const [ventures, setVentures] = useState<VentureWithStats[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState("");
  const today = useMemo(() => localDateKey(), []);

  // Filter changes are written to the URL; the derived `filters` follow.
  const applyFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, ...patch };
      const qs = paramsFromFilters(next);
      if (qs !== filterKey) router.replace(qs ? `/hq/tasks?${qs}` : "/hq/tasks", { scroll: false });
    },
    [filters, filterKey, router]
  );

  // Ventures for the select + create form.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/ventures")
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "사업 목록을 불러오지 못했습니다"));
        const data = (await res.json()) as { ventures: VentureWithStats[] };
        if (!cancelled) setVentures(data.ventures);
      })
      .catch((err) => {
        if (!cancelled) setError((prev) => prev || errorMessage(err, "사업 목록을 불러오지 못했습니다"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tasks for the current filters.
  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    const key = paramsFromFilters(filters);
    try {
      const sp = new URLSearchParams();
      sp.set("status", filters.status);
      if (filters.venture) sp.set("venture_id", filters.venture);
      if (filters.priority) sp.set("priority", filters.priority);
      if (filters.q) sp.set("q", filters.q);
      const res = await fetch(`/api/hq/tasks?${sp.toString()}`, { signal });
      if (!res.ok) throw new Error(await readError(res, "할 일을 불러오지 못했습니다"));
      const data = (await res.json()) as { tasks: TaskWithVenture[] };
      if (!signal?.aborted) setResult({ key, tasks: data.tasks, error: "" });
    } catch (err) {
      if (signal?.aborted) return;
      setResult((prev) => ({ key, tasks: prev?.tasks ?? [], error: errorMessage(err, "할 일을 불러오지 못했습니다") }));
    }
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    loadTasks(controller.signal);
    return () => controller.abort();
  }, [loadTasks]);

  const updateTask = useCallback((updated: TaskWithVenture) => {
    setResult((prev) => (prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)) } : prev));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<GroupKey, TaskWithVenture[]> = { overdue: [], today: [], week: [], later: [], done: [] };
    for (const t of tasks) map[groupOf(t, today)].push(t);
    return map;
  }, [tasks, today]);

  const filterActive = filters.venture !== "" || filters.priority !== "" || filters.q !== "";

  function emptyCopy(): { title: string; hint: string } {
    if (filters.q) return { title: `"${filters.q}"에 해당하는 할 일이 없습니다`, hint: "검색어를 바꾸거나 필터를 지워보세요" };
    if (filterActive) return { title: "조건에 맞는 할 일이 없습니다", hint: "필터를 지우면 더 많은 할 일이 보입니다" };
    switch (filters.status) {
      case "done":
        return { title: "완료한 할 일이 없습니다", hint: "할 일을 마치면 여기에 쌓입니다" };
      case "doing":
        return { title: "진행 중인 할 일이 없습니다", hint: "목록에서 '시작 →'을 눌러 진행을 시작하세요" };
      case "todo":
        return { title: "대기 중인 할 일이 없습니다", hint: "새 할 일을 추가하거나 비서에게 제안을 받아보세요" };
      case "all":
        return { title: "아직 할 일이 없습니다", hint: "첫 할 일을 추가해 오늘을 시작하세요" };
      default:
        return { title: "열린 할 일이 없습니다", hint: "모두 정리했습니다. 새 할 일을 추가하거나 비서와 다음 단계를 상의하세요" };
    }
  }

  const empty = emptyCopy();

  return (
    <div>
      <PageHeader
        title="할 일"
        subtitle="기한과 우선순위로 정리된 실행 목록"
        actions={
          <Button variant={showCreate ? "secondary" : "primary"} onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "닫기" : "+ 새 할 일"}
          </Button>
        }
      />

      <ErrorBanner
        message={error || loadError}
        onClose={() => {
          setError("");
          setResult((prev) => (prev ? { ...prev, error: "" } : prev));
        }}
      />

      {showCreate && (
        <CreateTaskForm
          ventures={ventures}
          defaultVentureId={filters.venture !== "none" ? filters.venture : ""}
          onCreated={(task) => {
            setShowCreate(false);
            const hidden =
              (filters.status === "done") ||
              (filters.venture === "none" ? !!task.venture_id : filters.venture !== "" && task.venture_id !== filters.venture) ||
              (filters.priority !== "" && task.priority !== filters.priority) ||
              (filters.q !== "" && !task.title.toLowerCase().includes(filters.q.toLowerCase()));
            setNotice(`"${task.title}" 추가됨${hidden ? " — 현재 필터에는 보이지 않습니다" : ""}`);
            loadTasks();
          }}
        />
      )}

      {notice && (
        <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg mb-4">
          <span className="truncate">{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="text-green-500 hover:text-green-700 shrink-0" aria-label="닫기">
            ✕
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 mb-4 space-y-3">
        <SearchBox committed={filters.q} onCommit={(q) => applyFilters({ q })} />
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="상태 필터">
          {STATUS_CHIPS.map((chip) => {
            const active = filters.status === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => applyFilters({ status: chip.value })}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={filters.venture} onChange={(e) => applyFilters({ venture: e.target.value })} aria-label="사업 필터">
            <option value="">사업: 전체</option>
            <option value="none">사업: 미지정</option>
            {ventures.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <Select value={filters.priority} onChange={(e) => applyFilters({ priority: e.target.value as Filters["priority"] })} aria-label="우선순위 필터">
            <option value="">우선순위: 전체</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} · {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between sm:justify-end gap-2 text-sm text-gray-500">
            <span className="tabular-nums">{loading ? "불러오는 중…" : `${tasks.length}개 표시`}</span>
            {(filterActive || filters.status !== DEFAULT_FILTERS.status) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => applyFilters({ ...DEFAULT_FILTERS })}
              >
                필터 지우기
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <LoadingBlock />
      ) : loadError && tasks.length === 0 ? null : tasks.length === 0 ? (
        <Card>
          <EmptyState
            title={empty.title}
            hint={empty.hint}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setShowCreate(true)}>+ 새 할 일</Button>
                <Button variant="secondary" onClick={() => router.push("/hq/secretary")}>
                  ✦ 비서에게 물어보기
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className={cx("space-y-6", loading && "opacity-60 transition-opacity")}>
          {GROUPS.map((g) => {
            const list = grouped[g.key];
            if (list.length === 0) return null;
            return (
              <section key={g.key}>
                <h2 className={cx("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2", g.labelClass)}>
                  {g.label}
                  <span className="text-gray-400 font-normal tabular-nums">{list.length}</span>
                </h2>
                <div className="space-y-2">
                  {list.map((t) => (
                    <TaskItem key={t.id} task={t} onChange={updateTask} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- create form ----------

function CreateTaskForm({
  ventures,
  defaultVentureId,
  onCreated,
}: {
  ventures: VentureWithStats[];
  defaultVentureId: string;
  onCreated: (task: TaskWithVenture) => void;
}) {
  const [title, setTitle] = useState("");
  const [ventureId, setVentureId] = useState(defaultVentureId);
  const [priority, setPriority] = useState<Priority>("P2");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    setError("");
    try {
      const checklist = checklistText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch("/api/hq/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          venture_id: ventureId || undefined,
          priority,
          due_date: dueDate || undefined,
          description: description.trim() || undefined,
          checklist: checklist.length ? checklist : undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "할 일을 추가하지 못했습니다"));
      const data = (await res.json()) as { task: TaskWithVenture };
      setTitle("");
      setDueDate("");
      setDescription("");
      setChecklistText("");
      onCreated(data.task);
    } catch (err) {
      setError(errorMessage(err, "할 일을 추가하지 못했습니다"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="새 할 일" className="mb-4">
      <form onSubmit={submit} className="space-y-3">
        <ErrorBanner message={error} onClose={() => setError("")} />
        <Field label="제목">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="무엇을 해야 하나요?" required maxLength={200} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="사업">
            <Select value={ventureId} onChange={(e) => setVentureId(e.target.value)}>
              <option value="">미지정</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="우선순위">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p} · {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="기한">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="설명" hint="선택 사항">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="배경, 완료 기준, 참고 링크" />
        </Field>
        <Field label="체크리스트" hint="한 줄에 하나">
          <Textarea rows={3} value={checklistText} onChange={(e) => setChecklistText(e.target.value)} placeholder={"자료 조사\n초안 작성\n검토 요청"} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="submit" loading={saving} disabled={!title.trim()}>
            추가
          </Button>
        </div>
      </form>
    </Card>
  );
}
