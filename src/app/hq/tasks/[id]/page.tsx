"use client";

// /hq/tasks/[id] — 할 일 상세: 인라인 편집, 상태/우선순위/기한/사업, 체크리스트, 코멘트.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Checklist from "@/components/hq/Checklist";
import CommentThread from "@/components/hq/CommentThread";
import { patchTask } from "@/components/hq/TaskItem";
import { Badge, Button, Card, ErrorBanner, Input, LoadingBlock, Select, SourceBadge, TaskStatusBadge, Textarea, cx } from "@/components/hq/ui";
import type { Comment, Priority, StatusResponse, TaskStatus, TaskWithVenture, Venture, VentureWithStats } from "@/lib/hq/types";
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from "@/lib/hq/types";
import { dueLabel, formatDate, formatDateTime, relativeTime } from "@/lib/hq/format";

interface TaskDetail {
  task: TaskWithVenture;
  venture: Venture | null;
  comments: Comment[];
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

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  // Keyed by id so all local state resets when navigating between tasks.
  return <TaskDetail key={params.id} />;
}

function TaskDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [ventures, setVentures] = useState<VentureWithStats[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Due date edits are committed after a pause (or on blur) so keyboard typing does not save partial dates.
  const dueTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dueInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => clearTimeout(dueTimer.current), []);
  // Reflect the saved due date in the (uncontrolled) input without remounting it, so focus survives a save.
  const savedDue = detail?.task.due_date ?? "";
  useEffect(() => {
    if (dueInputRef.current && dueInputRef.current.value !== savedDue) dueInputRef.current.value = savedDue;
  }, [savedDue]);
  function commitDue(value: string) {
    clearTimeout(dueTimer.current);
    // An empty value also appears while a segment is being retyped; clearing is only done via the ✕ button.
    if (!value) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    if (Number(value.slice(0, 4)) < 1970) return; // partial year while typing
    if (value === (detail?.task.due_date ?? "")) return;
    void save("due_date", { due_date: value });
  }
  function scheduleDueSave(value: string) {
    clearTimeout(dueTimer.current);
    if (!value) return;
    dueTimer.current = setTimeout(() => commitDue(value), 700);
  }
  async function clearDue() {
    clearTimeout(dueTimer.current);
    if (await save("due_date", { due_date: null }) && dueInputRef.current) dueInputRef.current.value = "";
  }

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  // Description editing
  const [editingDesc, setEditingDesc] = useState(false);
  // Tags editing
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // initial state is already loading/empty; the component is keyed by id
    fetch(`/api/hq/tasks/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(await readError(res, "할 일을 불러오지 못했습니다"));
        const data = (await res.json()) as TaskDetail;
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "할 일을 불러오지 못했습니다"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Secondary data: ventures for the select, AI status for the comment thread. Non-fatal.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/ventures")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { ventures: VentureWithStats[] };
        if (!cancelled) setVentures(data.ventures);
      })
      .catch(() => {});
    fetch("/api/hq/status")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (!cancelled) setAiEnabled(data.ai_enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setTask = useCallback((task: TaskWithVenture) => {
    setDetail((prev) => (prev ? { ...prev, task } : prev));
  }, []);

  const setComments = useCallback((update: (prev: Comment[]) => Comment[]) => {
    setDetail((prev) => (prev ? { ...prev, comments: update(prev.comments) } : prev));
  }, []);

  async function save(field: string, body: Record<string, unknown>): Promise<boolean> {
    if (!detail) return false;
    setSaving(field);
    setError("");
    try {
      const task = await patchTask(detail.task.id, body);
      setDetail((prev) => {
        if (!prev) return prev;
        const venture =
          body.venture_id === undefined || prev.venture?.id === task.venture_id
            ? prev.venture
            : ventures.find((v) => v.id === task.venture_id) ?? null;
        return { ...prev, task, venture };
      });
      return true;
    } catch (err) {
      setError(errorMessage(err, "저장하지 못했습니다"));
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function submitTitle(e: FormEvent) {
    e.preventDefault();
    const t = titleDraft.trim();
    if (!t) return;
    if (t === detail?.task.title || (await save("title", { title: t }))) setEditingTitle(false);
  }

  async function submitDesc(e: FormEvent) {
    e.preventDefault();
    const d = descDraft.trim();
    if (d === detail?.task.description || (await save("description", { description: d }))) setEditingDesc(false);
  }

  async function remove() {
    if (!detail) return;
    if (!confirm(`"${detail.task.title}"을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/hq/tasks/${detail.task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "삭제하지 못했습니다"));
      router.push("/hq/tasks");
    } catch (err) {
      setError(errorMessage(err, "삭제하지 못했습니다"));
      setDeleting(false);
    }
  }

  async function askSecretary(): Promise<Comment> {
    const res = await fetch(`/api/hq/tasks/${id}/advise`, { method: "POST" });
    if (!res.ok) throw new Error(await readError(res, "비서의 조언을 받지 못했습니다"));
    const data = (await res.json()) as { comment: Comment };
    return data.comment;
  }

  if (loading) return <LoadingBlock label="할 일 불러오는 중..." />;

  if (notFound || (!detail && loadError)) {
    return (
      <div>
        <ErrorBanner message={notFound ? "할 일을 찾을 수 없습니다. 삭제되었거나 주소가 잘못되었습니다." : loadError} />
        <Link href="/hq/tasks" className="text-sm text-indigo-600 hover:underline">
          ← 할 일 목록으로
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  const { task, venture, comments } = detail;
  const done = task.status === "done";
  const busy = saving !== null || deleting;

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-3">
        <Link href="/hq/tasks" className="hover:text-indigo-600">
          ☑ 할 일
        </Link>
        {venture && (
          <>
            <span className="mx-1.5 text-gray-300">/</span>
            <Link href={`/hq/ventures/${venture.id}`} className="hover:text-indigo-600">
              ▣ {venture.name}
            </Link>
          </>
        )}
      </nav>

      <ErrorBanner message={error} onClose={() => setError("")} />

      {/* Header */}
      <Card className="mb-4">
        {editingTitle ? (
          <form onSubmit={submitTitle} className="flex flex-col sm:flex-row gap-2">
            <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} autoFocus maxLength={200} className="text-lg font-semibold" aria-label="제목" />
            <div className="flex gap-2 shrink-0">
              <Button type="submit" size="sm" loading={saving === "title"} disabled={!titleDraft.trim()}>
                저장
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setEditingTitle(false)} disabled={saving === "title"}>
                취소
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <h1 className={cx("text-xl sm:text-2xl font-bold tracking-tight leading-snug min-w-0 break-words", done ? "line-through text-gray-400" : "text-gray-900")}>
              {task.title}
            </h1>
            <button
              type="button"
              onClick={() => {
                setTitleDraft(task.title);
                setEditingTitle(true);
              }}
              className="text-gray-400 hover:text-indigo-600 text-sm mt-1.5 shrink-0"
              aria-label="제목 수정"
              title="제목 수정"
            >
              ✎
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          <SourceBadge source={task.source} />
          {task.source === "claude" && task.source_ref && (
            <Link href={`/hq/knowledge/${task.source_ref}`} className="text-xs text-orange-700 hover:underline">
              원본 자료 보기 →
            </Link>
          )}
          {task.due_date && !done && <span className="text-xs text-gray-500">기한 {formatDate(task.due_date)} · {dueLabel(task.due_date)}</span>}
        </div>

        {/* Segmented status control */}
        <div className="mt-4 inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="상태 변경">
          {TASK_STATUSES.map((s: TaskStatus) => {
            const active = task.status === s;
            return (
              <button
                key={s}
                type="button"
                disabled={busy || active}
                onClick={() => save("status", { status: s })}
                aria-pressed={active}
                className={cx(
                  "px-3 py-1.5 text-sm font-medium transition-colors border-r border-gray-300 last:border-r-0 disabled:cursor-default",
                  active
                    ? s === "done"
                      ? "bg-green-600 text-white"
                      : s === "doing"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                )}
              >
                {TASK_STATUS_LABEL[s]}
              </button>
            );
          })}
          {saving === "status" && <span className="px-2 py-1.5 text-xs text-gray-400 self-center">저장 중…</span>}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">우선순위</span>
            <Select value={task.priority} disabled={busy} onChange={(e) => save("priority", { priority: e.target.value as Priority })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p} · {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">기한</span>
            <div className="flex gap-1.5">
              <Input
                ref={dueInputRef}
                type="date"
                defaultValue={task.due_date ?? ""}
                disabled={busy}
                onChange={(e) => scheduleDueSave(e.target.value)}
                onBlur={(e) => commitDue(e.target.value)}
              />
              {task.due_date && (
                <Button type="button" size="sm" variant="ghost" onClick={clearDue} disabled={busy} title="기한 지우기" aria-label="기한 지우기">
                  ✕
                </Button>
              )}
            </div>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">사업</span>
            <Select value={task.venture_id ?? ""} disabled={busy} onChange={(e) => save("venture_id", { venture_id: e.target.value || null })}>
              <option value="">미지정</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              {task.venture_id && !ventures.some((v) => v.id === task.venture_id) && (
                <option value={task.venture_id}>{task.venture_name ?? "연결된 사업"}</option>
              )}
            </Select>
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="danger" size="sm" onClick={remove} loading={deleting} disabled={saving !== null}>
            삭제
          </Button>
        </div>
      </Card>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="설명"
            actions={
              !editingDesc && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDescDraft(task.description);
                    setEditingDesc(true);
                  }}
                  disabled={busy}
                >
                  {task.description ? "✎ 수정" : "+ 작성"}
                </Button>
              )
            }
          >
            {editingDesc ? (
              <form onSubmit={submitDesc} className="space-y-2">
                <Textarea
                  rows={5}
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  autoFocus
                  placeholder="배경, 완료 기준, 참고 링크"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitDesc(e);
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditingDesc(false)} disabled={saving === "description"}>
                    취소
                  </Button>
                  <Button type="submit" size="sm" loading={saving === "description"}>
                    저장
                  </Button>
                </div>
              </form>
            ) : task.description ? (
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{task.description}</p>
            ) : (
              <p className="text-sm text-gray-400">설명이 없습니다. 배경과 완료 기준을 적어두면 비서가 더 정확히 돕습니다.</p>
            )}
          </Card>

          <Card>
            <Checklist task={task} onChange={setTask} />
          </Card>

          <Card
            title="태그"
            actions={
              !editingTags && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTagsDraft(task.tags.join(", "));
                    setEditingTags(true);
                  }}
                >
                  ✎ 수정
                </Button>
              )
            }
          >
            {editingTags ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const tags = Array.from(new Set(tagsDraft.split(",").map((t) => t.trim()).filter(Boolean)));
                  if (await save("tags", { tags })) setEditingTags(false);
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <Input value={tagsDraft} onChange={(e) => setTagsDraft(e.target.value)} placeholder="쉼표로 구분 (예: 디자인, 견적)" autoFocus className="flex-1" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditingTags(false)} disabled={saving === "tags"}>
                    취소
                  </Button>
                  <Button type="submit" size="sm" loading={saving === "tags"}>
                    저장
                  </Button>
                </div>
              </form>
            ) : task.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <Badge key={tag} className="bg-gray-50 text-gray-600 border-gray-200">
                    #{tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">태그가 없습니다. 검색과 분류에 쓰입니다.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CommentThread targetType="task" targetId={task.id} comments={comments} onChange={setComments} onAskSecretary={askSecretary} aiEnabled={aiEnabled} />
          </Card>

          <Card title="정보">
            <dl className="text-xs text-gray-500 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt>만든 날</dt>
                <dd className="text-gray-700 text-right">{formatDateTime(task.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>마지막 수정</dt>
                <dd className="text-gray-700 text-right" title={formatDateTime(task.updated_at)}>
                  {relativeTime(task.updated_at)}
                </dd>
              </div>
              {task.completed_at && (
                <div className="flex justify-between gap-3">
                  <dt>완료</dt>
                  <dd className="text-green-700 text-right">{formatDateTime(task.completed_at)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
