"use client";

// /hq/search — 통합 검색: 사업·할 일·자료·코멘트를 한 번에 찾고 종류별로 거른다.
import { Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, LoadingBlock, PageHeader, cx } from "@/components/hq/ui";
import type { SearchHit, SearchHitKind, SearchResponse } from "@/lib/hq/types";
import { relativeTime } from "@/lib/hq/format";

type KindFilter = "all" | SearchHitKind;

const KIND_ORDER: SearchHitKind[] = ["venture", "task", "knowledge", "comment"];

const KIND_INFO: Record<SearchHitKind, { label: string; glyph: string; className: string }> = {
  venture: { label: "사업", glyph: "▣", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  task: { label: "할 일", glyph: "☑", className: "bg-green-50 text-green-700 border-green-200" },
  knowledge: { label: "자료", glyph: "⇩", className: "bg-orange-50 text-orange-700 border-orange-200" },
  comment: { label: "코멘트", glyph: "✎", className: "bg-purple-50 text-purple-700 border-purple-200" },
};



function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Same tokenization as the server: whitespace-split, case-insensitive, at most 8 tokens. */
function queryTokens(q: string): string[] {
  const seen = new Set<string>();
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !seen.has(t) && seen.add(t))
    .slice(0, 8)
    .sort((a, b) => b.length - a.length);
}

function buildHighlighter(tokens: string[]): RegExp | null {
  if (!tokens.length) return null;
  return new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
}

/** Wraps every token occurrence in <mark>; plain React nodes, no HTML injection. */
function highlight(text: string, re: RegExp | null): ReactNode {
  if (!text || !re) return text;
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-yellow-100 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
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

interface SearchResult {
  key: string;
  data: SearchResponse | null;
  error: string;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingBlock label="검색 준비 중..." />}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") || "").trim().slice(0, 200);
  const [reloadToken, setReloadToken] = useState(0);
  const fetchKey = `${reloadToken}:${q}`;
  // The result remembers which query it was loaded for, so "loading" is derived rather than tracked.
  const [result, setResult] = useState<SearchResult | null>(null);
  const loading = q !== "" && result?.key !== fetchKey;
  const current = result && result.key === fetchKey ? result : null;
  const data = current?.data ?? null;
  const error = current?.error ?? "";
  const total = data ? KIND_ORDER.reduce((sum, k) => sum + (data.counts[k] ?? 0), 0) : 0;

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    fetch(`/api/hq/search?q=${encodeURIComponent(q)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "검색에 실패했습니다."));
        return (await res.json()) as SearchResponse;
      })
      .then((json) => {
        if (!cancelled) setResult({ key: fetchKey, data: json, error: "" });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ key: fetchKey, data: null, error: errorMessage(err, "검색 중 문제가 생겼습니다. 다시 시도하세요.") });
      });
    return () => {
      cancelled = true;
    };
  }, [q, fetchKey]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = new FormData(e.currentTarget).get("q");
    const next = (typeof raw === "string" ? raw : "").trim().slice(0, 200);
    if (next === q) {
      if (next) setReloadToken((n) => n + 1);
      return;
    }
    router.replace(next ? `/hq/search?q=${encodeURIComponent(next)}` : "/hq/search");
  }

  const subtitle = !q
    ? "사업, 할 일, 자료, 코멘트를 한 번에 찾습니다."
    : loading
    ? `"${q}" 검색 중...`
    : error
    ? `"${q}"`
    : `"${q}" · 총 ${total}건`;

  return (
    <div>
      <PageHeader title="검색" subtitle={subtitle} />

      {/* Keyed by q so the field resets when the query changes from elsewhere (sidebar, back/forward). */}
      <form key={q} onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 mb-6" role="search">
        <Input type="search" name="q" defaultValue={q} placeholder="찾을 단어를 입력하세요" aria-label="검색어" autoComplete="off" autoFocus={!q} className="flex-1" />
        <Button type="submit" loading={loading}>
          검색
        </Button>
      </form>

      {!q ? (
        <Card>
          <EmptyState
            title="검색어를 입력하세요"
            hint="사업 이름·목표·태그, 할 일 제목·설명·체크리스트, 가져온 자료의 제목·요약·원문, 코멘트 내용을 찾습니다. 여러 단어는 띄어쓰기로 구분하면 모두 포함된 항목만 보여줍니다."
          />
        </Card>
      ) : loading ? (
        <LoadingBlock label="검색 중..." />
      ) : error ? (
        <ErrorBanner message={error} onClose={() => setReloadToken((n) => n + 1)} />
      ) : data ? (
        <SearchResults key={fetchKey} q={q} data={data} total={total} />
      ) : null}
    </div>
  );
}

/** Chips + result list. Keyed by the query so the kind filter resets on each new search. */
function SearchResults({ q, data, total }: { q: string; data: SearchResponse; total: number }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const re = useMemo(() => buildHighlighter(queryTokens(q)), [q]);
  const hits = useMemo(() => (kind === "all" ? data.hits : data.hits.filter((h) => h.kind === kind)), [data, kind]);

  if (total === 0) {
    return (
      <Card>
        <EmptyState
          title="검색 결과가 없습니다"
          hint="다른 단어나 더 짧은 단어로 다시 찾아보세요. 아직 자료를 가져오지 않았다면 Claude 대화를 먼저 가져오세요."
          action={
            <Link href="/hq/import" className="text-sm text-indigo-600 hover:underline">
              자료 가져오기 →
            </Link>
          }
        />
      </Card>
    );
  }

  const chips: { value: KindFilter; label: string; count: number }[] = [
    { value: "all", label: "전체", count: total },
    ...KIND_ORDER.map((k) => ({ value: k, label: KIND_INFO[k].label, count: data.counts[k] ?? 0 })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="결과 종류">
        {chips.map((chip) => {
          const active = chip.value === kind;
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(chip.value)}
              disabled={chip.count === 0 && chip.value !== "all"}
              className={cx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                active ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              {chip.label}
              <span className={cx("tabular-nums", active ? "text-indigo-100" : "text-gray-400")}>{chip.count}</span>
            </button>
          );
        })}
      </div>

      {data.truncated && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          결과가 많아 일부만 표시합니다. 더 구체적인 단어로 검색하면 정확도가 올라갑니다.
        </p>
      )}

      <Card>
        {hits.length === 0 ? (
          <EmptyState
            title={`${kind === "all" ? "" : KIND_INFO[kind].label + " "}결과가 표시 범위에 없습니다`}
            hint="다른 종류를 선택하거나 더 구체적인 단어로 검색하세요."
            action={
              <Button variant="secondary" size="sm" onClick={() => setKind("all")}>
                전체 보기
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-1">{hits.length}개 표시</p>
            <ul className="divide-y divide-gray-100">
              {hits.map((hit) => (
                <SearchRow key={`${hit.kind}:${hit.id}`} hit={hit} re={re} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function SearchRow({ hit, re }: { hit: SearchHit; re: RegExp | null }) {
  const info = KIND_INFO[hit.kind];
  const meta = hit.meta;
  const when = relativeTime(hit.updated_at);
  return (
    <li className="py-3 flex gap-3">
      <div className="shrink-0 pt-0.5">
        <Badge className={info.className}>
          <span aria-hidden="true" className="mr-1">
            {info.glyph}
          </span>
          {info.label}
        </Badge>
      </div>
      <div className="min-w-0 flex-1">
        <Link href={hit.href} className="block font-medium text-gray-900 hover:text-indigo-600 break-words line-clamp-2">
          {highlight(hit.title || "(제목 없음)", re)}
        </Link>
        {(meta || when) && (
          <p className="text-xs text-gray-500 mt-0.5 break-words">
            {[meta, when].filter(Boolean).join(" · ")}
          </p>
        )}
        {hit.snippet && <p className="text-sm text-gray-600 mt-1 break-words line-clamp-3">{highlight(hit.snippet, re)}</p>}
      </div>
    </li>
  );
}
