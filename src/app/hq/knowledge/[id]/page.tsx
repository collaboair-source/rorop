"use client";

// 자료 상세: 요약 · 비서의 관찰 · 도출된 할 일 · 코멘트 · 원문.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Comment, KnowledgeItem, KnowledgeKind, KnowledgeListItem, StatusResponse, TaskWithVenture, Venture, VentureWithStats } from "@/lib/hq/types";
import { formatDate, formatDateTime, relativeTime } from "@/lib/hq/format";
import TaskItem from "@/components/hq/TaskItem";
import CommentThread from "@/components/hq/CommentThread";
import { PageHeader, Card, EmptyState, LoadingBlock, ErrorBanner, Button, Select, Badge, RichText, cx } from "@/components/hq/ui";

const KIND_LABEL: Record<KnowledgeKind, string> = {
  conversation: "대화",
  project: "프로젝트",
  note: "메모",
};

const KIND_CLASS: Record<KnowledgeKind, string> = {
  conversation: "bg-orange-50 text-orange-700 border-orange-200",
  project: "bg-purple-50 text-purple-700 border-purple-200",
  note: "bg-gray-100 text-gray-600 border-gray-200",
};

const COLLAPSE_THRESHOLD = 3000;
const COLLAPSED_CHARS = 1500;

interface DetailResponse {
  item: KnowledgeItem;
  venture: Venture | null;
  tasks: TaskWithVenture[];
  comments: Comment[];
}

interface AnalyzeResponse {
  item: KnowledgeListItem;
  venture: Venture | null;
  tasks: TaskWithVenture[];
  comment: Comment;
  truncated: boolean;
  skipped_duplicates?: number;
}

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

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function KnowledgeDetailPage() {
  const params = useParams<{ id: string }>();
  // Keyed by id so all local state resets when navigating between items.
  return <KnowledgeDetail key={params.id} />;
}

function KnowledgeDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [item, setItem] = useState<KnowledgeItem | null>(null);
  const [venture, setVenture] = useState<Venture | null>(null);
  const [tasks, setTasks] = useState<TaskWithVenture[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [ventures, setVentures] = useState<VentureWithStats[]>([]);
  const [venturesError, setVenturesError] = useState("");

  const [actionError, setActionError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeNote, setAnalyzeNote] = useState("");
  const [recreateTasks, setRecreateTasks] = useState(false);
  const [linking, setLinking] = useState(false);
  const [showLinkSelect, setShowLinkSelect] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [statusError, setStatusError] = useState("");
  const aiEnabled = status ? status.ai_enabled : true;

  // State updates happen only inside promise callbacks so this is safe to call from effects and handlers.
  const load = useCallback(
    () =>
      fetch(`/api/hq/knowledge/${id}`)
        .then(async (res) => {
          if (res.status === 404) {
            setNotFound(true);
            return;
          }
          const data = await parseResponse<DetailResponse>(res, "자료를 불러오지 못했습니다");
          setItem(data.item);
          setVenture(data.venture);
          setTasks(data.tasks);
          setComments(data.comments);
          setExpanded(data.item.content.length <= COLLAPSE_THRESHOLD);
        })
        .catch((err: unknown) => setLoadError(errorMessage(err, "자료를 불러오지 못했습니다")))
        .finally(() => setLoading(false)),
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    load();
    fetch("/api/hq/status")
      .then((res) => parseResponse<StatusResponse>(res, "AI 상태를 확인하지 못했습니다"))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Unknown ≠ disabled: keep the analyze button available.
        if (!cancelled) setStatusError("AI 상태를 확인하지 못했습니다. 분석을 시도하면 서버가 다시 확인합니다.");
      });
    fetch("/api/hq/ventures")
      .then((res) => parseResponse<{ ventures: VentureWithStats[] }>(res, "사업 목록을 불러오지 못했습니다"))
      .then((data) => {
        if (!cancelled) setVentures(data.ventures);
      })
      .catch((err) => {
        if (!cancelled) setVenturesError(errorMessage(err, "사업 목록을 불러오지 못했습니다"));
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function linkVenture(ventureId: string) {
    if (!item) return;
    setLinking(true);
    setActionError("");
    try {
      const res = await fetch(`/api/hq/knowledge/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId || null }),
      });
      const data = await parseResponse<{ item: KnowledgeListItem }>(res, "사업을 연결하지 못했습니다");
      setItem((prev) => (prev ? { ...prev, venture_id: data.item.venture_id } : prev));
      const found = ventureId ? ventures.find((v) => v.id === ventureId) : undefined;
      setVenture(found ?? null);
      setShowLinkSelect(false);
    } catch (err) {
      setActionError(errorMessage(err, "사업을 연결하지 못했습니다"));
    } finally {
      setLinking(false);
    }
  }

  async function analyze() {
    if (!item || analyzing) return;
    const createTasks = item.analyzed ? recreateTasks : true;
    setAnalyzing(true);
    setActionError("");
    setAnalyzeNote("");
    try {
      const res = await fetch(`/api/hq/knowledge/${item.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create_tasks: createTasks, create_venture: true }),
      });
      const data = await parseResponse<AnalyzeResponse>(res, "분석하지 못했습니다");
      setItem((prev) => (prev ? { ...prev, ...data.item, content: prev.content } : prev));
      setVenture(data.venture);
      if (data.venture) {
        const created = data.venture;
        setVentures((prev) => (prev.some((v) => v.id === created.id) ? prev : [{ ...created, task_total: 0, task_open: 0, task_done: 0 }, ...prev]));
      }
      if (data.tasks.length) {
        setTasks((prev) => {
          const known = new Set(prev.map((t) => t.id));
          return [...data.tasks.filter((t) => !known.has(t.id)), ...prev];
        });
      }
      setComments((prev) => [...prev, data.comment]);
      const parts = [data.venture ? `사업 「${data.venture.name}」에 연결` : "사업 미지정", `할 일 ${data.tasks.length}개 등록`];
      if (data.skipped_duplicates) parts.push(`이미 있는 할 일 ${data.skipped_duplicates}개 건너뜀`);
      if (data.truncated) parts.push("자료가 길어 앞부분만 분석");
      setAnalyzeNote(parts.join(", "));
      setRecreateTasks(false);
    } catch (err) {
      setActionError(errorMessage(err, "분석하지 못했습니다"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove() {
    if (!item || deleting) return;
    if (!confirm(`「${item.title}」 자료를 삭제할까요?\n분석으로 만든 할 일은 남지만, 코멘트 ${comments.length}개는 함께 삭제됩니다.`)) return;
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/hq/knowledge/${item.id}`, { method: "DELETE" });
      await parseResponse<{ ok: boolean }>(res, "삭제하지 못했습니다");
      router.push("/hq/import");
    } catch (err) {
      setActionError(errorMessage(err, "삭제하지 못했습니다"));
      setDeleting(false);
    }
  }

  function onTaskChange(updated: TaskWithVenture) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  if (loading) return <LoadingBlock />;

  if (notFound || !item) {
    return (
      <div>
        <ErrorBanner message={loadError || "자료를 찾을 수 없습니다. 삭제되었거나 주소가 잘못되었습니다."} />
        <Link href="/hq/import" className="text-sm text-indigo-600 hover:underline">
          ← 가져온 자료 목록으로
        </Link>
      </div>
    );
  }

  const insights = item.analysis?.insights ?? [];
  const content = item.content;
  const isLong = content.length > COLLAPSE_THRESHOLD;
  const shownContent = expanded || !isLong ? content : `${content.slice(0, COLLAPSED_CHARS)}\n…`;

  return (
    <div>
      <Link href="/hq/import" className="inline-block text-xs text-gray-500 hover:text-indigo-600 mb-2">
        ← 가져온 자료
      </Link>
      <PageHeader
        title={item.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {item.analyzed && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={recreateTasks} onChange={(e) => setRecreateTasks(e.target.checked)} disabled={analyzing} className="h-3.5 w-3.5 accent-indigo-600" />
                할 일도 다시 생성
              </label>
            )}
            <Button onClick={analyze} loading={analyzing} disabled={!aiEnabled || deleting} title={!aiEnabled ? "AI 비서가 꺼져 있습니다" : ""}>
              {analyzing ? "분석 중…" : item.analyzed ? "✦ 다시 분석" : "✦ 분석하기"}
            </Button>
            <Button variant="danger" onClick={remove} loading={deleting} disabled={analyzing}>
              삭제
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-gray-500 -mt-3 mb-5">
        <Badge className={KIND_CLASS[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
        <Badge className={item.analyzed ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}>{item.analyzed ? "분석 완료" : "미분석"}</Badge>
        {item.source_date && <span>원본 {formatDate(item.source_date)}</span>}
        <span>{content.length.toLocaleString()}자</span>
        <span className="flex items-center gap-1.5">
          {venture ? (
            <>
              <Link href={`/hq/ventures/${venture.id}`} className="text-gray-700 hover:text-indigo-600 font-medium">
                ▣ {venture.name}
              </Link>
              {!showLinkSelect && (
                <button type="button" onClick={() => setShowLinkSelect(true)} className="text-xs text-gray-400 hover:text-indigo-600" disabled={linking}>
                  변경
                </button>
              )}
            </>
          ) : (
            !showLinkSelect && <span>사업 미지정</span>
          )}
          {(showLinkSelect || !venture) && (
            <span className="inline-block w-44">
              <Select
                value={item.venture_id ?? ""}
                onChange={(e) => linkVenture(e.target.value)}
                disabled={linking || ventures.length === 0}
                className="py-1 text-xs"
                aria-label="사업 연결"
              >
                <option value="">{ventures.length ? "사업 연결…" : "사업 없음"}</option>
                {ventures.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </span>
          )}
          {showLinkSelect && (
            <button type="button" onClick={() => setShowLinkSelect(false)} className="text-xs text-gray-400 hover:text-gray-700" disabled={linking}>
              취소
            </button>
          )}
        </span>
      </div>

      {statusError && !status && <div className="bg-gray-100 border border-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg mb-4">{statusError}</div>}
      {status && !status.ai_enabled && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg mb-4">
          AI 비서가 꺼져 있어 분석할 수 없습니다.{status.hint ? ` ${status.hint}` : ""}
        </div>
      )}
      <ErrorBanner message={venturesError} onClose={() => setVenturesError("")} />
      <ErrorBanner message={actionError} onClose={() => setActionError("")} />
      {analyzeNote && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg mb-4 flex items-start justify-between gap-3">
          <span>분석 완료 — {analyzeNote}</span>
          <button type="button" onClick={() => setAnalyzeNote("")} className="text-green-500 hover:text-green-700 shrink-0" aria-label="닫기">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
          <Card title="요약" actions={item.analysis?.analyzed_at ? <span className="text-xs text-gray-400">{formatDateTime(item.analysis.analyzed_at)} 분석</span> : undefined}>
            {item.summary ? (
              <RichText text={item.summary} />
            ) : (
              <EmptyState
                title="아직 분석 전입니다"
                hint="분석하면 비서가 요약하고 관련 사업과 할 일을 뽑아냅니다"
                action={
                  <Button size="sm" onClick={analyze} loading={analyzing} disabled={!aiEnabled}>
                    ✦ 분석하기
                  </Button>
                }
              />
            )}
          </Card>

          {insights.length > 0 && (
            <Card title="✦ 비서의 관찰">
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-800">
                {insights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title={
              <>
                도출된 할 일 <span className="text-gray-400 font-normal text-sm">{tasks.length}</span>
              </>
            }
          >
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">{item.analyzed ? "이 자료에서 만들어진 할 일이 없습니다." : "분석하면 여기에 할 일이 등록됩니다."}</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <TaskItem key={t.id} task={t} onChange={onTaskChange} />
                ))}
              </div>
            )}
          </Card>

          <Card
            title="원문"
            actions={
              isLong ? (
                <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
                  {expanded ? "접기" : "전체 보기"}
                </Button>
              ) : undefined
            }
          >
            <pre className={cx("whitespace-pre-wrap break-words text-xs text-gray-700 font-mono leading-relaxed", !expanded && isLong && "max-h-96 overflow-hidden")}>{shownContent}</pre>
            {isLong && !expanded && (
              <div className="mt-3 flex justify-center">
                <Button size="sm" variant="secondary" onClick={() => setExpanded(true)}>
                  전체 보기 ({content.length.toLocaleString()}자)
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 min-w-0">
          <Card>
            <CommentThread targetType="knowledge" targetId={item.id} comments={comments} onChange={setComments} />
          </Card>
          <Card title="정보">
            <dl className="text-xs text-gray-500 space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt>가져온 시각</dt>
                <dd className="text-gray-700" title={formatDateTime(item.created_at)}>
                  {relativeTime(item.created_at)}
                </dd>
              </div>
              {item.source_date && (
                <div className="flex justify-between gap-2">
                  <dt>원본 날짜</dt>
                  <dd className="text-gray-700">{formatDateTime(item.source_date)}</dd>
                </div>
              )}
              {item.source_uuid && (
                <div className="flex justify-between gap-2">
                  <dt>원본 ID</dt>
                  <dd className="text-gray-700 font-mono truncate max-w-[10rem]" title={item.source_uuid}>
                    {item.source_uuid}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
