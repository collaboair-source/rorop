"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ScoreBadge, { DeadlineBadge, FIT_LEVEL_CLS, SourceBadge } from "@/components/support/ScoreBadge";
import type { MatchResult, ProgramAnalysis, SupportProgram } from "@/lib/support/types";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Detail {
  program: SupportProgram;
  match: MatchResult;
  analysis: ProgramAnalysis | null;
  markdown: string | null;
  analysis_stale: boolean;
  ai: { configured: boolean; model: string };
}

const STATUS_CLS: Record<string, string> = {
  충족: "bg-green-100 text-green-800",
  미충족: "bg-red-100 text-red-700",
  불명확: "bg-amber-100 text-amber-800",
};
const RISK_CLS: Record<string, string> = {
  낮음: "bg-green-100 text-green-800",
  보통: "bg-amber-100 text-amber-800",
  높음: "bg-red-100 text-red-700",
};

export default function SupportDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [user, setUser] = useState<User | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/support/programs/${encodeURIComponent(id)}`);
    if (r.status === 401) {
      router.push("/login");
      return;
    }
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || "불러오기 실패");
      return;
    }
    setDetail(data);
  }, [id, router]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) {
          router.push("/login");
          return;
        }
        setUser((await r.json()).user);
      })
      .catch(() => router.push("/login"));
    load();
  }, [router, load]);

  async function handleAnalyze(force: boolean) {
    setAnalyzing(true);
    setError("");
    try {
      const r = await fetch(`/api/support/programs/${encodeURIComponent(id)}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "분석 실패");
      setDetail((d) => (d ? { ...d, analysis: data.analysis, markdown: data.markdown, analysis_stale: false } : d));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 공고를 목록에서 삭제할까요? (다음 크롤링에서 다시 수집될 수 있습니다)")) return;
    await fetch(`/api/support/programs/${encodeURIComponent(id)}`, { method: "DELETE" });
    router.push("/support");
  }

  async function copyMarkdown() {
    if (!detail?.markdown) return;
    await navigator.clipboard.writeText(detail.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!user) return null;

  if (!detail) {
    return (
      <div className="min-h-screen">
        <Navbar user={user} />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-gray-400">{error || "불러오는 중…"}</main>
      </div>
    );
  }

  const { program: p, match, analysis } = detail;

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/support" className="text-sm text-gray-500 hover:text-gray-700">← 목록으로</Link>

        {/* 헤더 */}
        <div className="mt-3 bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex gap-5">
            <ScoreBadge score={match.score} size="lg" label="규칙 점수" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <SourceBadge source={p.source} />
                <DeadlineBadge status={match.status} daysLeft={match.days_left} applyEnd={p.apply_end} />
                {p.category && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{[p.category, p.subcategory].filter(Boolean).join(" › ")}</span>}
              </div>
              <h1 className="text-xl font-bold leading-snug">{p.title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {[p.organization, p.executing_org, p.department].filter(Boolean).join(" · ")}
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">원문 공고 열기 ↗</a>
                )}
                {p.attachments.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="text-gray-600 hover:underline">📎 {a.name}</a>
                ))}
                <button onClick={handleDelete} className="text-gray-400 hover:text-red-600 ml-auto">삭제</button>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* 공고 정보 */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold mb-3">공고 정보</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="접수 기간" value={`${p.apply_start || "?"} ~ ${p.apply_end || "미상 (상시/예산 소진 시)"}`} />
                <Field label="지원 지역" value={p.region} />
                <Field label="지원 대상" value={p.target} />
                <Field label="사업 경력" value={p.business_age} />
                <Field label="대상 연령" value={p.target_age} />
                <Field label="문의" value={p.contact} />
              </dl>
              {p.target_detail && <TextBlock label="신청 대상 상세" text={p.target_detail} />}
              {p.exclusion && <TextBlock label="제외 대상" text={p.exclusion} />}
              <TextBlock label="사업 개요" text={p.summary || "(개요가 수집되지 않았습니다. 원문 공고를 확인하세요. 개요를 ‘직접 추가’로 붙여 넣으면 AI 분석 정확도가 올라갑니다.)"} />
              {p.apply_method && <TextBlock label="신청 방법" text={p.apply_method} />}
              {p.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {p.hashtags.map((h) => (
                    <span key={h} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">#{h}</span>
                  ))}
                </div>
              )}
            </section>

            {/* AI 분석 */}
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold">AI 적합도 분석 · 지원 가이드</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    내 사업 프로필 기준으로 요건 충족 여부, 끼워 맞출 각도, 새로 갖출 요건, 사업계획서 포인트를 만듭니다. ({detail.ai.model})
                  </p>
                </div>
                <div className="flex gap-2">
                  {analysis && detail.markdown && (
                    <button onClick={copyMarkdown} className="border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
                      {copied ? "복사됨 ✓" : "마크다운 복사"}
                    </button>
                  )}
                  <button
                    onClick={() => handleAnalyze(Boolean(analysis))}
                    disabled={analyzing || !detail.ai.configured}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {analyzing ? "분석 중… (1~3분)" : analysis ? "다시 분석" : "AI 분석 실행"}
                  </button>
                </div>
              </div>

              {!detail.ai.configured && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                  <code className="bg-white px-1 rounded">ANTHROPIC_API_KEY</code> 가 설정되지 않았습니다. <code className="bg-white px-1 rounded">.env</code> 에 키를 넣고 서버를 재시작하면 AI 분석을 쓸 수 있습니다.
                </div>
              )}
              {detail.analysis_stale && analysis && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4">
                  이 분석은 이전 사업 프로필 기준입니다. 프로필이 바뀌었으니 “다시 분석”을 권장합니다.
                </div>
              )}

              {!analysis && detail.ai.configured && !analyzing && (
                <p className="text-sm text-gray-400">아직 분석하지 않았습니다. 버튼을 눌러 시작하세요.</p>
              )}

              {analysis && <AnalysisView analysis={analysis} />}
            </section>
          </div>

          {/* 사이드: 규칙 점수 근거 */}
          <aside className="space-y-6">
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold mb-1">규칙 기반 점수 근거</h2>
              <p className="text-xs text-gray-500 mb-3">AI 없이 키워드·지역·사업경력·대상 조건을 기계적으로 대조한 결과입니다.</p>
              {match.hard_blockers.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {match.hard_blockers.map((b) => (
                    <li key={b} className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1">✗ {b}</li>
                  ))}
                </ul>
              )}
              <ul className="space-y-1.5">
                {match.reasons.map((r, i) => (
                  <li key={i} className="flex justify-between gap-3 text-sm">
                    <span className="text-gray-700">{r.label}</span>
                    <span className={`font-mono ${r.delta > 0 ? "text-green-700" : r.delta < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mt-3">
                점수 기준이 되는 프로필은 <Link href="/support/profile" className="text-indigo-600 underline">내 사업 프로필</Link>에서 수정합니다.
              </p>
            </section>
            <section className="bg-white rounded-lg border border-gray-200 p-5 text-xs text-gray-500 space-y-1">
              <div>수집: {new Date(p.first_seen_at).toLocaleString("ko-KR")}</div>
              <div>최근 확인: {new Date(p.last_seen_at).toLocaleString("ko-KR")}</div>
              {p.posted_at && <div>공고 등록일: {p.posted_at}</div>}
              <div className="font-mono break-all">{p.id}</div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-500 mb-1">{label}</h3>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

function AnalysisView({ analysis: a }: { analysis: ProgramAnalysis }) {
  const g = a.application_guide;
  return (
    <div className="space-y-6">
      {/* 헤드라인 */}
      <div className="flex flex-wrap items-center gap-3">
        <ScoreBadge score={a.fit_score} size="lg" label="AI 적합도" />
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${FIT_LEVEL_CLS[a.fit_level]}`}>적합도 {a.fit_level}</span>
            <span className="text-sm px-2.5 py-1 rounded-full font-medium bg-gray-900 text-white">{a.recommended_action}</span>
          </div>
          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{a.summary}</p>
        </div>
      </div>

      {/* 자격 요건 */}
      <Block title="자격 요건 체크">
        <ul className="space-y-1.5">
          {a.eligibility.map((e, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium h-fit ${STATUS_CLS[e.status]}`}>{e.status}</span>
              <div>
                <div className="text-gray-900">{e.requirement}</div>
                {e.note && <div className="text-gray-500 text-xs mt-0.5">{e.note}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Block>

      {a.direct_angles.length > 0 && (
        <Block title="지금 사업 그대로 어필할 포인트">
          <BulletList items={a.direct_angles} />
        </Block>
      )}

      {a.stretch_angles.length > 0 && (
        <Block title="끼워 맞추기 각도 — 사업을 재해석/확장해서 요건 안에 넣는 방법" subtitle="사실에 기반한 재해석만 제안합니다. 위험도가 높을수록 심사에서 억지로 보일 수 있습니다.">
          <div className="space-y-3">
            {a.stretch_angles.map((s, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{s.angle}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_CLS[s.risk]}`}>위험 {s.risk}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.how}</p>
              </div>
            ))}
          </div>
        </Block>
      )}

      {a.requirements_to_acquire.length > 0 && (
        <Block title="새로 확보하면 지원 가능해지는 요건" subtitle="지금은 없지만 갖추면 자격이 생기거나 가점을 받는 항목과 확보 방법입니다.">
          <div className="space-y-3">
            {a.requirements_to_acquire.map((r, i) => (
              <div key={i} className="border border-indigo-100 bg-indigo-50/40 rounded-lg p-3 text-sm">
                <div className="font-medium">{r.requirement}</div>
                <div className="text-gray-600 mt-1"><span className="text-gray-400">왜:</span> {r.why}</div>
                <div className="text-gray-800 mt-1 whitespace-pre-wrap"><span className="text-gray-400">방법:</span> {r.how}</div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                  <span>난이도/비용: {r.effort}</span>
                  <span>소요: {r.lead_time}</span>
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      <Block title="지원 가이드">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Sub title="마감 역산 일정"><BulletList items={g.timeline} /></Sub>
          <Sub title="준비 서류"><BulletList items={g.documents} /></Sub>
        </div>
        <Sub title="사업계획서 목차별 핵심 포인트">
          <div className="space-y-2">
            {g.plan_outline.map((s, i) => (
              <div key={i}>
                <div className="text-sm font-medium">{s.section}</div>
                <BulletList items={s.points} />
              </div>
            ))}
          </div>
        </Sub>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Sub title="심사위원에게 전달할 핵심 메시지"><BulletList items={g.key_messages} /></Sub>
          <Sub title="예상 평가 지표와 대응"><BulletList items={g.evaluation_focus} /></Sub>
        </div>
      </Block>

      {a.risks.length > 0 && (
        <Block title="리스크 / 주의">
          <BulletList items={a.risks} />
        </Block>
      )}
      {a.next_steps.length > 0 && (
        <Block title="다음 할 일">
          <ul className="space-y-1">
            {a.next_steps.map((n, i) => (
              <li key={i} className="flex gap-2 text-sm"><span className="text-gray-400">☐</span><span>{n}</span></li>
            ))}
          </ul>
        </Block>
      )}
      <p className="text-xs text-gray-400">분석 모델 {a.model} · {new Date(a.created_at).toLocaleString("ko-KR")} · 프로필 {a.profile_hash}</p>
    </div>
  );
}

function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-gray-900 mb-1">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mb-2">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</h4>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
      {items.map((it, i) => (
        <li key={i} className="whitespace-pre-wrap">{it}</li>
      ))}
    </ul>
  );
}
