"use client";

// 사업 목록: 필터 칩 + 카드 그리드 + 인라인 생성 폼.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Priority, VentureStatus, VentureWithStats } from "@/lib/hq/types";
import { PRIORITIES, PRIORITY_LABEL, VENTURE_STATUSES, VENTURE_STATUS_LABEL } from "@/lib/hq/types";
import { relativeTime } from "@/lib/hq/format";
import {
  PageHeader,
  Card,
  EmptyState,
  LoadingBlock,
  ErrorBanner,
  Button,
  Input,
  Textarea,
  Select,
  Field,
  PriorityBadge,
  VentureStatusBadge,
  cx,
} from "@/components/hq/ui";

type StatusFilter = "all" | VentureStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: VENTURE_STATUS_LABEL.active },
  { value: "idea", label: VENTURE_STATUS_LABEL.idea },
  { value: "paused", label: VENTURE_STATUS_LABEL.paused },
  { value: "done", label: VENTURE_STATUS_LABEL.done },
];

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 본문이 JSON이 아닌 경우 (네트워크/프록시 오류 등)
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

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function VentureCard({ venture }: { venture: VentureWithStats }) {
  const pct = venture.task_total ? Math.round((venture.task_done / venture.task_total) * 100) : 0;
  return (
    <Link
      href={`/hq/ventures/${venture.id}`}
      className="flex h-full flex-col bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 hover:border-indigo-300 hover:shadow transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 leading-snug break-words min-w-0">▣ {venture.name}</h3>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <VentureStatusBadge status={venture.status} />
        <PriorityBadge priority={venture.priority} />
      </div>
      {venture.summary ? (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{venture.summary}</p>
      ) : (
        <p className="mt-3 text-sm text-gray-400">설명 없음</p>
      )}
      {venture.goal && (
        <p className="mt-2 text-xs text-gray-500 truncate">
          <span className="font-medium text-gray-600">목표:</span> {venture.goal}
        </p>
      )}
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>
            {venture.task_total > 0 ? (
              <>
                할 일 {venture.task_done}/{venture.task_total} · <span className="font-medium text-gray-700">{venture.task_open}개 남음</span>
              </>
            ) : (
              "할 일 없음"
            )}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <ProgressBar done={venture.task_done} total={venture.task_total} />
        <div className="mt-2 text-[11px] text-gray-400">업데이트 {relativeTime(venture.updated_at)}</div>
      </div>
    </Link>
  );
}

export default function VenturesPage() {
  const [ventures, setVentures] = useState<VentureWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  // 생성 폼
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState<VentureStatus>("active");
  const [priority, setPriority] = useState<Priority>("P2");
  const [tags, setTags] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/hq/ventures");
        const data = await parseResponse<{ ventures: VentureWithStats[] }>(res, "사업 목록을 불러오지 못했습니다");
        if (!cancelled) setVentures(data.ventures);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "사업 목록을 불러오지 못했습니다");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: ventures.length, idea: 0, active: 0, paused: 0, done: 0 };
    for (const v of ventures) c[v.status] += 1;
    return c;
  }, [ventures]);

  const visible = useMemo(() => (filter === "all" ? ventures : ventures.filter((v) => v.status === filter)), [ventures, filter]);

  function resetForm() {
    setName("");
    setSummary("");
    setGoal("");
    setStatus("active");
    setPriority("P2");
    setTags("");
    setFormError("");
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("사업 이름을 입력하세요");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      const res = await fetch("/api/hq/ventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          summary: summary.trim(),
          goal: goal.trim(),
          status,
          priority,
          tags: parseTags(tags),
        }),
      });
      const data = await parseResponse<{ venture: VentureWithStats }>(res, "사업을 만들지 못했습니다");
      setVentures((prev) => [data.venture, ...prev]);
      resetForm();
      setShowForm(false);
      if (filter !== "all" && filter !== data.venture.status) setFilter("all");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "사업을 만들지 못했습니다");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="사업"
        subtitle={loading ? "사업 현황을 불러오는 중" : `${counts.all}개 사업 · 진행 중 ${counts.active}개`}
        actions={
          <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "닫기" : "+ 새 사업"}
          </Button>
        }
      />

      {showForm && (
        <Card title="새 사업 만들기" className="mb-6">
          <form onSubmit={create} className="space-y-4">
            <ErrorBanner message={formError} onClose={() => setFormError("")} />
            <Field label="이름">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 로롭 디자인 SaaS" autoFocus maxLength={120} required />
            </Field>
            <Field label="한 줄 설명" hint="무엇을 하는 사업인지 짧게">
              <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="핵심 고객과 제공 가치" />
            </Field>
            <Field label="목표" hint="이 분기·이번 달에 도달할 결과">
              <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="예: 유료 고객 10곳 확보" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="상태">
                <Select value={status} onChange={(e) => setStatus(e.target.value as VentureStatus)}>
                  {VENTURE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {VENTURE_STATUS_LABEL[s]}
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
              <Field label="태그" hint="쉼표로 구분">
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="SaaS, B2B" />
              </Field>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={creating}
              >
                취소
              </Button>
              <Button type="submit" loading={creating} disabled={!name.trim()}>
                만들기
              </Button>
            </div>
          </form>
        </Card>
      )}

      <ErrorBanner message={error} onClose={() => setError("")} />

      {loading ? (
        <LoadingBlock label="사업을 불러오는 중..." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="상태 필터">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.value)}
                  className={cx(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                  )}
                >
                  {f.label}
                  <span className={cx("tabular-nums", active ? "text-indigo-100" : "text-gray-400")}>{counts[f.value]}</span>
                </button>
              );
            })}
          </div>

          {error && ventures.length === 0 ? null : visible.length === 0 ? (
            <Card>
              {ventures.length === 0 ? (
                <EmptyState
                  title="아직 사업이 없습니다"
                  hint="첫 사업을 만들거나 Claude 대화를 가져와서 비서가 정리하게 하세요."
                  action={
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={() => setShowForm(true)}>+ 새 사업</Button>
                      <Link href="/hq/import" className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        ⇩ Claude에서 가져오기
                      </Link>
                    </div>
                  }
                />
              ) : (
                <EmptyState
                  title={`${FILTERS.find((f) => f.value === filter)?.label ?? ""} 상태의 사업이 없습니다`}
                  hint="다른 상태를 선택하거나 전체를 보세요."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
                      전체 보기
                    </Button>
                  }
                />
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((v) => (
                <VentureCard key={v.id} venture={v} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
