"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ScoreBadge, { DeadlineBadge, FIT_LEVEL_CLS, SourceBadge } from "@/components/support/ScoreBadge";
import type { ProgramListItem } from "@/lib/support/types";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Stats {
  total_programs: number;
  active: number;
  closing_soon: number;
  new_this_week: number;
  analyzed: number;
  last_crawl_at: string | null;
}

interface StatusInfo {
  logs: { id: string; trigger: string; finished_at: string; results: { source: string; ok: boolean; method: string; fetched: number; added: number; updated: number; error?: string }[]; new_program_ids: string[] }[];
  store: { file: string | null; persist_error: string | null; programs: number; analyses: number };
  config: { bizinfo_api_key: boolean; data_go_kr_service_key: boolean; anthropic: boolean; model: string; webhook: boolean; cron_secret: boolean; auto_analyze_top_n: number };
}

const EMPTY_STATS: Stats = { total_programs: 0, active: 0, closing_soon: 0, new_this_week: 0, analyzed: 0, last_crawl_at: null };

export default function SupportListPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ProgramListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", url: "", summary: "", apply_end: "", region: "", target: "", organization: "" });

  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [source, setSource] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState("score");
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyAnalyzed, setOnlyAnalyzed] = useState(false);

  const loadStatus = useCallback(async () => {
    const r = await fetch("/api/support/crawl/status");
    if (r.ok) setStatus(await r.json());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ q, source, status: statusFilter, sort, minScore: String(minScore) });
    if (onlyNew) sp.set("onlyNew", "1");
    if (onlyAnalyzed) sp.set("onlyAnalyzed", "1");
    const r = await fetch(`/api/support/programs?${sp.toString()}`);
    if (r.ok) {
      const data = await r.json();
      setItems(data.items);
      setTotal(data.total);
      setStats(data.stats);
    }
    setLoading(false);
  }, [q, source, statusFilter, sort, minScore, onlyNew, onlyAnalyzed]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) {
          router.push("/login");
          return;
        }
        const data = await r.json();
        setUser(data.user);
      })
      .catch(() => router.push("/login"));
    loadStatus();
  }, [router, loadStatus]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleCrawl() {
    setCrawling(true);
    setMessage(null);
    try {
      const r = await fetch("/api/support/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "크롤링 실패");
      const failed = (data.results || []).filter((x: { ok: boolean }) => !x.ok);
      const summary = (data.results || []).map((x: { source: string; ok: boolean; method: string; fetched: number; added: number }) => `${x.source}: ${x.ok ? `${x.fetched}건(${x.method}) 신규 ${x.added}` : "실패"}`).join(" · ");
      setMessage({ kind: failed.length ? "warn" : "ok", text: `크롤링 완료 — ${summary}${data.warnings?.length ? `\n${data.warnings.join("\n")}` : ""}` });
      await Promise.all([load(), loadStatus()]);
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setCrawling(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/support/programs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addForm) });
    const data = await r.json();
    if (!r.ok) {
      setMessage({ kind: "err", text: data.error });
      return;
    }
    setShowAdd(false);
    setAddForm({ title: "", url: "", summary: "", apply_end: "", region: "", target: "", organization: "" });
    router.push(`/support/${encodeURIComponent(data.program.id)}`);
  }

  if (!user) return null;

  const cfg = status?.config;
  const lastLog = status?.logs?.[0];

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">지원사업 매칭</h1>
            <p className="text-gray-500 text-sm mt-1">
              기업마당·K-Startup 공고를 매주 수집해 내 사업과의 적합도를 점수화하고, AI 가 지원 가이드를 만들어 줍니다.
              {stats.last_crawl_at && <span className="ml-2 text-gray-400">마지막 수집 {new Date(stats.last_crawl_at).toLocaleString("ko-KR")}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(!showAdd)} className="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              + 직접 추가
            </button>
            <button onClick={handleCrawl} disabled={crawling} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {crawling ? "수집 중… (1~2분)" : "지금 크롤링"}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${message.kind === "ok" ? "bg-green-50 text-green-800 border border-green-200" : message.kind === "warn" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {message.text}
          </div>
        )}

        {/* 설정 상태 */}
        {cfg && (
          <div className="mb-6 flex flex-wrap gap-2 text-xs">
            <ConfigChip ok={cfg.bizinfo_api_key} label="기업마당 API 키" hint="없으면 HTML 파싱(불안정)" />
            <ConfigChip ok={cfg.data_go_kr_service_key} label="공공데이터포털 키" hint="없으면 HTML 파싱(불안정)" />
            <ConfigChip ok={cfg.anthropic} label={`Claude (${cfg.model})`} hint="없으면 AI 가이드 불가" />
            <ConfigChip ok={cfg.webhook} label="주간 알림 웹훅" hint="선택" />
            <ConfigChip ok={cfg.cron_secret} label="스케줄러 CRON_SECRET" hint="주간 자동 실행에 필요" />
            {status?.store.persist_error && <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">저장 경고: {status.store.persist_error}</span>}
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Stat label="전체 공고" value={stats.total_programs} />
          <Stat label="진행 중" value={stats.active} />
          <Stat label="마감 임박 (7일)" value={stats.closing_soon} accent={stats.closing_soon > 0 ? "text-red-600" : ""} />
          <Stat label="이번 주 신규" value={stats.new_this_week} accent="text-indigo-600" />
          <Stat label="AI 분석 완료" value={stats.analyzed} />
        </div>

        {/* 직접 추가 */}
        {showAdd && (
          <form onSubmit={handleAdd} className="bg-white rounded-lg border border-gray-200 p-5 mb-6 space-y-3">
            <h2 className="font-semibold">공고 직접 추가</h2>
            <p className="text-xs text-gray-500">크롤러가 놓친 공고나 다른 사이트의 공고를 붙여 넣으면 같은 방식으로 점수·AI 가이드를 만들 수 있습니다.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="공고명 *" value={addForm.title} onChange={(v) => setAddForm({ ...addForm, title: v })} required />
              <Input label="공고 URL" value={addForm.url} onChange={(v) => setAddForm({ ...addForm, url: v })} />
              <Input label="마감일 (YYYY-MM-DD)" value={addForm.apply_end} onChange={(v) => setAddForm({ ...addForm, apply_end: v })} />
              <Input label="지원지역" value={addForm.region} onChange={(v) => setAddForm({ ...addForm, region: v })} />
              <Input label="지원대상" value={addForm.target} onChange={(v) => setAddForm({ ...addForm, target: v })} />
              <Input label="공고기관" value={addForm.organization} onChange={(v) => setAddForm({ ...addForm, organization: v })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">공고 본문 (붙여넣기)</label>
              <textarea value={addForm.summary} onChange={(e) => setAddForm({ ...addForm, summary: e.target.value })} rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">추가</button>
              <button type="button" onClick={() => setShowAdd(false)} className="text-gray-500 text-sm hover:text-gray-700">취소</button>
            </div>
          </form>
        )}

        {/* 검색/필터 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qInput);
            }}
            className="flex gap-2 mb-3"
          >
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="공고명, 기관, 키워드 검색 (예: AI 바우처, 서울 입주, 수출)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">검색</button>
          </form>
          <div className="flex flex-wrap gap-3 text-sm items-center">
            <select value={source} onChange={(e) => setSource(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
              <option value="all">모든 출처</option>
              <option value="bizinfo">기업마당</option>
              <option value="kstartup">K-Startup</option>
              <option value="manual">직접 추가</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
              <option value="active">진행 중 (마감 제외)</option>
              <option value="closing_soon">마감 임박</option>
              <option value="open">접수 중</option>
              <option value="unknown">상시/미상</option>
              <option value="closed">마감</option>
              <option value="all">전체</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
              <option value="score">매칭 점수순</option>
              <option value="ai">AI 적합도순</option>
              <option value="deadline">마감 임박순</option>
              <option value="newest">최근 수집순</option>
            </select>
            <label className="flex items-center gap-1.5">
              최소 점수
              <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value) || 0)} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> 신규만
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={onlyAnalyzed} onChange={(e) => setOnlyAnalyzed(e.target.checked)} /> AI 분석된 것만
            </label>
            <span className="text-gray-400 ml-auto">{loading ? "불러오는 중…" : `${total}건`}</span>
          </div>
        </div>

        {/* 목록 */}
        {items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">{stats.total_programs === 0 ? "아직 수집된 공고가 없습니다" : "조건에 맞는 공고가 없습니다"}</p>
            <p className="text-sm">
              {stats.total_programs === 0 ? (
                <>
                  “지금 크롤링” 을 누르거나 터미널에서 <code className="bg-gray-100 px-1 rounded">npm run crawl</code> 을 실행하세요. 먼저 <Link href="/support/profile" className="text-indigo-600 underline">내 사업 프로필</Link>을 채우면 점수가 정확해집니다.
                </>
              ) : (
                "필터를 바꾸거나 검색어를 지워 보세요."
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <Link key={p.id} href={`/support/${encodeURIComponent(p.id)}`} className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-indigo-300 transition-colors">
                <div className="flex gap-4">
                  <ScoreBadge score={p.match.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <SourceBadge source={p.source} />
                      {p.is_new && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">NEW</span>}
                      <DeadlineBadge status={p.match.status} daysLeft={p.match.days_left} applyEnd={p.apply_end} />
                      {p.analysis && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FIT_LEVEL_CLS[p.analysis.fit_level]}`}>
                          AI {p.analysis.fit_score}점 · {p.analysis.recommended_action}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold leading-snug">{p.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {[p.category, p.organization, p.region, p.target].filter(Boolean).join(" · ")}
                    </p>
                    {(p.match.matched_keywords.length > 0 || p.match.hard_blockers.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.match.matched_keywords.slice(0, 6).map((k) => (
                          <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">{k}</span>
                        ))}
                        {p.match.hard_blockers.map((b) => (
                          <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">✗ {b}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 최근 크롤링 로그 */}
        {lastLog && (
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-4 text-sm">
            <h3 className="font-medium mb-2">최근 수집 기록</h3>
            <ul className="space-y-1 text-gray-600">
              {status!.logs.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <span className="text-gray-400">{new Date(l.finished_at).toLocaleString("ko-KR")}</span> · {l.trigger} ·{" "}
                  {l.results.map((r) => `${r.source} ${r.ok ? `${r.fetched}건(${r.method}, 신규 ${r.added})` : `실패: ${r.error}`}`).join(" / ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function ConfigChip({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <span className={`px-2 py-1 rounded border ${ok ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`} title={ok ? "설정됨" : `미설정 — ${hint}`}>
      {ok ? "●" : "○"} {label}
      {!ok && <span className="ml-1 text-gray-400">({hint})</span>}
    </span>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
  );
}
