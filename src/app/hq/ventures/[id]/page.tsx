"use client";

// 사업 상세: 인라인 편집 헤더, 개요, 할 일, 코멘트, 연결된 자료.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Comment, KnowledgeKind, KnowledgeListItem, Priority, TaskWithVenture, VentureStatus, VentureWithStats } from "@/lib/hq/types";
import { PRIORITIES, PRIORITY_LABEL, VENTURE_STATUSES, VENTURE_STATUS_LABEL } from "@/lib/hq/types";
import { formatDate, relativeTime } from "@/lib/hq/format";
import {
  Card,
  EmptyState,
  LoadingBlock,
  ErrorBanner,
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  PriorityBadge,
  VentureStatusBadge,
  SourceBadge,
  cx,
} from "@/components/hq/ui";
import TaskItem from "@/components/hq/TaskItem";
import CommentThread from "@/components/hq/CommentThread";

interface DetailResponse {
  venture: VentureWithStats;
  tasks: TaskWithVenture[];
  comments: Comment[];
  knowledge: KnowledgeListItem[];
}

type OverviewField = "summary" | "goal" | "tags";

const KIND_LABEL: Record<KnowledgeKind, string> = {
  conversation: "대화",
  project: "프로젝트",
  note: "메모",
};

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 본문이 JSON이 아닌 경우
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `${fallback} (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t) seen.add(t);
  }
  return Array.from(seen);
}

function BackLink() {
  return (
    <Link href="/hq/ventures" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600">
      ← 사업 목록
    </Link>
  );
}

export default function VentureDetailPage() {
  const params = useParams<{ id: string }>();
  // Keyed by id so all local state resets when navigating between ventures.
  return <VentureDetail key={params.id} />;
}

function VentureDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [venture, setVenture] = useState<VentureWithStats | null>(null);
  const [tasks, setTasks] = useState<TaskWithVenture[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  // 이름 편집
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // 상태/우선순위 즉시 저장
  const [savingMeta, setSavingMeta] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 개요 편집
  const [editingField, setEditingField] = useState<OverviewField | null>(null);
  const [fieldDraft, setFieldDraft] = useState("");
  const [savingField, setSavingField] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  // 할 일 빠른 추가
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("P2");
  const [taskDue, setTaskDue] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [hideDone, setHideDone] = useState(false);

  // State updates happen only inside promise callbacks so this is safe to call from effects and handlers.
  const load = useCallback(
    () =>
      fetch(`/api/hq/ventures/${id}`)
        .then(async (res) => {
          if (res.status === 404) {
            setNotFound(true);
            return;
          }
          const data = await parseResponse<DetailResponse>(res, "사업을 불러오지 못했습니다");
          setVenture(data.venture);
          setTasks(data.tasks);
          setComments(data.comments);
          setKnowledge(data.knowledge);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "사업을 불러오지 못했습니다"))
        .finally(() => setLoading(false)),
    [id]
  );

  useEffect(() => {
    if (!id) return;
    void load();
  }, [id, load]);

  function reload() {
    setLoading(true);
    setError("");
    setNotFound(false);
    void load();
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, done, open: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const visibleTasks = useMemo(() => (hideDone ? tasks.filter((t) => t.status !== "done") : tasks), [tasks, hideDone]);

  async function patchVenture(body: Record<string, unknown>): Promise<VentureWithStats> {
    const res = await fetch(`/api/hq/ventures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseResponse<{ venture: VentureWithStats }>(res, "저장하지 못했습니다");
    return data.venture;
  }

  // ---------- 이름 ----------
  function startEditName() {
    if (!venture) return;
    setNameDraft(venture.name);
    setEditingName(true);
  }

  async function saveName() {
    if (!venture) return;
    const next = nameDraft.trim();
    if (!next) {
      setError("사업 이름을 입력하세요");
      return;
    }
    if (next === venture.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    setError("");
    try {
      const updated = await patchVenture({ name: next });
      setVenture(updated);
      setTasks((prev) => prev.map((t) => ({ ...t, venture_name: updated.name })));
      setEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이름을 저장하지 못했습니다");
    } finally {
      setSavingName(false);
    }
  }

  function onNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveName();
    } else if (e.key === "Escape") {
      setEditingName(false);
    }
  }

  // ---------- 상태 / 우선순위 ----------
  async function changeMeta(patch: { status?: VentureStatus; priority?: Priority }) {
    if (!venture) return;
    const previous = venture;
    setVenture({ ...venture, ...patch });
    setSavingMeta(true);
    setError("");
    try {
      setVenture(await patchVenture(patch));
    } catch (err) {
      setVenture(previous);
      setError(err instanceof Error ? err.message : "저장하지 못했습니다");
    } finally {
      setSavingMeta(false);
    }
  }

  // ---------- 삭제 ----------
  async function remove() {
    if (!venture) return;
    const ok = confirm(`"${venture.name}" 사업을 삭제할까요?\n연결된 할 일은 남고 사업 연결만 해제되지만, 이 사업의 코멘트 ${comments.length}개는 함께 삭제됩니다.`);
    if (!ok) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/hq/ventures/${id}`, { method: "DELETE" });
      await parseResponse<{ ok: boolean }>(res, "삭제하지 못했습니다");
      router.push("/hq/ventures");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다");
      setDeleting(false);
    }
  }

  // ---------- 개요 ----------
  function startEditField(field: OverviewField) {
    if (!venture) return;
    setOverviewError("");
    setFieldDraft(field === "tags" ? venture.tags.join(", ") : venture[field]);
    setEditingField(field);
  }

  async function saveField() {
    if (!venture || !editingField) return;
    setSavingField(true);
    setOverviewError("");
    try {
      const body: Record<string, unknown> = editingField === "tags" ? { tags: parseTags(fieldDraft) } : { [editingField]: fieldDraft.trim() };
      setVenture(await patchVenture(body));
      setEditingField(null);
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "저장하지 못했습니다");
    } finally {
      setSavingField(false);
    }
  }

  // ---------- 할 일 ----------
  async function addTask(e: FormEvent) {
    e.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    setAddingTask(true);
    setTaskError("");
    try {
      const res = await fetch("/api/hq/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          venture_id: id,
          priority: taskPriority,
          due_date: taskDue || undefined,
        }),
      });
      const data = await parseResponse<{ task: TaskWithVenture }>(res, "할 일을 추가하지 못했습니다");
      setTasks((prev) => [data.task, ...prev]);
      setTaskTitle("");
      setTaskDue("");
      setTaskPriority("P2");
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "할 일을 추가하지 못했습니다");
    } finally {
      setAddingTask(false);
    }
  }

  function onTaskChange(updated: TaskWithVenture) {
    setTasks((prev) => {
      // 다른 사업으로 옮겨진 경우 이 목록에서 제거
      if (updated.venture_id !== id) return prev.filter((t) => t.id !== updated.id);
      return prev.map((t) => (t.id === updated.id ? updated : t));
    });
  }

  // ---------- 렌더 ----------
  if (loading) {
    return (
      <div>
        <BackLink />
        <LoadingBlock label="사업을 불러오는 중..." />
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <BackLink />
        <div className="mt-4">
          <ErrorBanner message="사업을 찾을 수 없습니다. 삭제되었거나 주소가 잘못되었을 수 있습니다." />
          <Link href="/hq/ventures" className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            사업 목록으로
          </Link>
        </div>
      </div>
    );
  }

  if (!venture) {
    return (
      <div>
        <BackLink />
        <div className="mt-4">
          <ErrorBanner message={error || "사업을 불러오지 못했습니다"} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reload}>
              다시 시도
            </Button>
            <Link href="/hq/ventures" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              사업 목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hiddenDoneCount = hideDone ? tasks.length - visibleTasks.length : 0;

  return (
    <div>
      <div className="mb-3">
        <BackLink />
      </div>

      {/* 헤더 */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={onNameKey}
                  autoFocus
                  maxLength={120}
                  aria-label="사업 이름"
                  className="text-lg font-semibold"
                />
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => void saveName()} loading={savingName} disabled={!nameDraft.trim()}>
                    저장
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingName(false)} disabled={savingName}>
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight break-words min-w-0">▣ {venture.name}</h1>
                <button
                  type="button"
                  onClick={startEditName}
                  className="mt-1 shrink-0 text-gray-400 hover:text-indigo-600 text-base leading-none"
                  aria-label="이름 수정"
                  title="이름 수정"
                >
                  ✎
                </button>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
              <VentureStatusBadge status={venture.status} />
              <PriorityBadge priority={venture.priority} />
              <SourceBadge source={venture.source} />
              <span className="ml-1">
                만듦 {formatDate(venture.created_at)} · 업데이트 {relativeTime(venture.updated_at)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 shrink-0">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              상태
              <Select
                value={venture.status}
                onChange={(e) => void changeMeta({ status: e.target.value as VentureStatus })}
                disabled={savingMeta}
                className="w-32"
                aria-label="사업 상태"
              >
                {VENTURE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {VENTURE_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              우선순위
              <Select
                value={venture.priority}
                onChange={(e) => void changeMeta({ priority: e.target.value as Priority })}
                disabled={savingMeta}
                className="w-32"
                aria-label="우선순위"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p} · {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="danger" onClick={() => void remove()} loading={deleting}>
              삭제
            </Button>
          </div>
        </div>

        {/* 진행률 */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>
              {stats.total > 0 ? (
                <>
                  할 일 {stats.done}/{stats.total} 완료 · <span className="font-medium text-gray-700">{stats.open}개 남음</span>
                </>
              ) : (
                "아직 할 일이 없습니다"
              )}
            </span>
            <span className="tabular-nums">{stats.pct}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={stats.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${stats.pct}%` }} />
          </div>
        </div>
      </div>

      <ErrorBanner message={error} onClose={() => setError("")} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽 2열 */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* 개요 */}
          <Card title="개요">
            <ErrorBanner message={overviewError} onClose={() => setOverviewError("")} />
            <div className="space-y-5">
              <OverviewRow
                label="설명"
                editing={editingField === "summary"}
                onEdit={() => startEditField("summary")}
                onCancel={() => setEditingField(null)}
                onSave={() => void saveField()}
                saving={savingField}
                editor={
                  <Textarea rows={3} value={fieldDraft} onChange={(e) => setFieldDraft(e.target.value)} placeholder="무엇을 하는 사업인지 짧게" autoFocus />
                }
              >
                {venture.summary ? <p className="text-sm text-gray-800 whitespace-pre-line">{venture.summary}</p> : <p className="text-sm text-gray-400">설명이 없습니다. ✎를 눌러 추가하세요.</p>}
              </OverviewRow>

              <OverviewRow
                label="목표"
                editing={editingField === "goal"}
                onEdit={() => startEditField("goal")}
                onCancel={() => setEditingField(null)}
                onSave={() => void saveField()}
                saving={savingField}
                editor={<Textarea rows={2} value={fieldDraft} onChange={(e) => setFieldDraft(e.target.value)} placeholder="도달할 결과를 숫자로" autoFocus />}
              >
                {venture.goal ? (
                  <p className="text-sm text-gray-800 whitespace-pre-line">
                    <span className="font-medium text-gray-600">목표:</span> {venture.goal}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">목표가 없습니다. 측정 가능한 결과를 적어두세요.</p>
                )}
              </OverviewRow>

              <OverviewRow
                label="태그"
                editing={editingField === "tags"}
                onEdit={() => startEditField("tags")}
                onCancel={() => setEditingField(null)}
                onSave={() => void saveField()}
                saving={savingField}
                editor={<Input value={fieldDraft} onChange={(e) => setFieldDraft(e.target.value)} placeholder="쉼표로 구분 (SaaS, B2B)" autoFocus />}
              >
                {venture.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {venture.tags.map((t) => (
                      <Badge key={t} className="bg-gray-50 text-gray-600 border-gray-200">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">태그 없음</p>
                )}
              </OverviewRow>
            </div>
          </Card>

          {/* 할 일 */}
          <Card
            title={
              <>
                할 일 <span className="text-gray-400 font-normal text-sm">{stats.open}개 남음</span>
              </>
            }
            actions={
              <button
                type="button"
                onClick={() => setHideDone((v) => !v)}
                className={cx("text-xs rounded-full border px-2.5 py-1 transition-colors", hideDone ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-gray-500 border-gray-200 hover:text-gray-700")}
                aria-pressed={hideDone}
              >
                {hideDone ? "완료 보이기" : "완료 숨기기"}
              </button>
            }
          >
            <form onSubmit={addTask} className="mb-4">
              <ErrorBanner message={taskError} onClose={() => setTaskError("")} />
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="할 일 추가"
                  aria-label="할 일 제목"
                  maxLength={200}
                  className="flex-1"
                />
                <div className="flex flex-wrap gap-2">
                  <Select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as Priority)} aria-label="우선순위" className="w-28">
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p} · {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </Select>
                  <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} aria-label="기한" className="min-w-0 flex-1 sm:flex-none sm:w-40" />
                  <Button type="submit" loading={addingTask} disabled={!taskTitle.trim()}>
                    추가
                  </Button>
                </div>
              </div>
            </form>

            {tasks.length === 0 ? (
              <EmptyState title="이 사업의 할 일이 없습니다" hint="위 입력창에서 첫 할 일을 추가하세요." />
            ) : visibleTasks.length === 0 ? (
              <EmptyState
                title="남은 할 일이 없습니다"
                hint={`완료 ${hiddenDoneCount}개가 숨겨져 있습니다.`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setHideDone(false)}>
                    완료 보이기
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {visibleTasks.map((t) => (
                  <TaskItem key={t.id} task={t} onChange={onTaskChange} showVenture={false} />
                ))}
                {hiddenDoneCount > 0 && <p className="text-xs text-gray-400 pt-1">완료 {hiddenDoneCount}개 숨김</p>}
              </div>
            )}
          </Card>
        </div>

        {/* 오른쪽 1열 */}
        <div className="space-y-6 min-w-0">
          <Card>
            <CommentThread targetType="venture" targetId={venture.id} comments={comments} onChange={setComments} />
          </Card>

          <Card
            title={
              <>
                연결된 자료 <span className="text-gray-400 font-normal text-sm">{knowledge.length}</span>
              </>
            }
          >
            {knowledge.length === 0 ? (
              <div className="text-sm text-gray-400">
                <p>연결된 자료가 없습니다.</p>
                <Link href="/hq/import" className="mt-2 inline-block text-indigo-600 hover:underline">
                  ⇩ Claude에서 가져오기
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {knowledge.map((k) => (
                  <li key={k.id} className="rounded-lg border border-gray-200 px-3 py-2 hover:border-indigo-300 transition-colors">
                    <Link href={`/hq/knowledge/${k.id}`} className="block font-medium text-sm text-gray-900 hover:text-indigo-600 leading-snug break-words">
                      {k.title || "(제목 없음)"}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                      <Badge className="bg-gray-50 text-gray-600 border-gray-200">{KIND_LABEL[k.kind]}</Badge>
                      <Badge className={k.analyzed ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}>
                        {k.analyzed ? "분석 완료" : "미분석"}
                      </Badge>
                      {k.task_count > 0 && <span>☑ {k.task_count}</span>}
                      {k.source_date && <span>{formatDate(k.source_date)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverviewRow({
  label,
  editing,
  editor,
  onEdit,
  onCancel,
  onSave,
  saving,
  children,
}: {
  label: string;
  editing: boolean;
  editor: ReactNode;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
        {!editing && (
          <button type="button" onClick={onEdit} className="text-gray-400 hover:text-indigo-600 text-sm leading-none" aria-label={`${label} 수정`} title={`${label} 수정`}>
            ✎
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {editor}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
              취소
            </Button>
            <Button size="sm" onClick={onSave} loading={saving}>
              저장
            </Button>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
