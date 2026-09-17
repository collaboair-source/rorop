"use client";

// Claude 가져오기: 내보내기 JSON 업로드 / 텍스트 붙여넣기 → 자료 등록 → 비서 분석.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { KnowledgeKind, KnowledgeListItem, StatusResponse, TaskWithVenture, Venture } from "@/lib/hq/types";
import { formatDate, relativeTime } from "@/lib/hq/format";
import { parseClaudeExport, textToCandidate } from "@/lib/hq/claude-export";
import type { ImportCandidate } from "@/lib/hq/claude-export";
import {
  PageHeader,
  Card,
  EmptyState,
  LoadingBlock,
  ErrorBanner,
  Button,
  Input,
  Textarea,
  Field,
  Badge,
  Spinner,
  cx,
} from "@/components/hq/ui";

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

const DETECTED_LABEL: Record<"conversations" | "projects" | "mixed" | "unknown", string> = {
  conversations: "대화 파일",
  projects: "프로젝트 파일",
  mixed: "대화 + 프로젝트",
  unknown: "알 수 없는 형식",
};

const PAGE_SIZE = 300;
const CHUNK_SIZE = 50;

type Tab = "file" | "paste";

interface Candidate {
  key: string;
  c: ImportCandidate;
}

interface FileReport {
  name: string;
  detected: keyof typeof DETECTED_LABEL;
  count: number;
  skipped: number;
  duplicates: number;
  error: string | null;
}

interface ImportProgress {
  sent: number;
  total: number;
  created: number;
  skipped: number;
}

interface RowNote {
  tone: "ok" | "error";
  text: string;
}

interface AnalyzeResponse {
  item: KnowledgeListItem;
  venture: Venture | null;
  tasks: TaskWithVenture[];
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

function formatChars(n: number): string {
  return `${n.toLocaleString()}자`;
}

function KindBadge({ kind }: { kind: KnowledgeKind }) {
  return <Badge className={KIND_CLASS[kind]}>{KIND_LABEL[kind]}</Badge>;
}

function AnalyzedBadge({ analyzed }: { analyzed: boolean }) {
  return (
    <Badge className={analyzed ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}>
      {analyzed ? "분석 완료" : "미분석"}
    </Badge>
  );
}

export default function ImportPage() {
  // ---------- AI 상태 ----------
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState("");
  const aiEnabled = status ? status.ai_enabled : true;

  // ---------- 업로드 / 후보 ----------
  const [tab, setTab] = useState<Tab>("file");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reports, setReports] = useState<FileReport[]>([]);
  const [parsing, setParsing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [importing, setImporting] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState("");
  const [importNote, setImportNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- 텍스트 붙여넣기 ----------
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasting, setPasting] = useState(false);
  const [pasteError, setPasteError] = useState("");
  const [pasteNote, setPasteNote] = useState("");

  // ---------- 가져온 자료 ----------
  const [items, setItems] = useState<KnowledgeListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [analyzing, setAnalyzing] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState<Record<string, RowNote>>({});
  const [deleting, setDeleting] = useState<Set<string>>(() => new Set());
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [batchError, setBatchError] = useState("");
  const stopBatchRef = useRef(false);

  const loadList = useCallback(async () => {
    setListError("");
    try {
      const res = await fetch("/api/hq/knowledge");
      const data = await parseResponse<{ items: KnowledgeListItem[] }>(res, "자료 목록을 불러오지 못했습니다");
      setItems(data.items);
    } catch (err) {
      setListError(errorMessage(err, "자료 목록을 불러오지 못했습니다"));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/status")
      .then((res) => parseResponse<StatusResponse>(res, "AI 상태를 확인하지 못했습니다"))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Unknown ≠ disabled: keep AI actions available and say the check failed.
        if (!cancelled) setStatusError("AI 상태를 확인하지 못했습니다. 분석을 시도하면 서버가 다시 확인합니다.");
      });
    loadList();
    return () => {
      cancelled = true;
    };
  }, [loadList]);

  // ---------- 파일 파싱 ----------
  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setParsing(true);
    setImportError("");
    setImportNote("");
    // 렌더가 먼저 반영되도록 한 틱 양보 (큰 파일은 JSON.parse가 UI를 잠시 막음)
    await new Promise((r) => setTimeout(r, 0));

    const existingKeys = new Set(candidates.map((c) => c.key));
    const added: Candidate[] = [];
    const newReports: FileReport[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const result = parseClaudeExport(text);
        let duplicates = 0;
        result.candidates.forEach((c, idx) => {
          const key = c.source_uuid ? `uuid:${c.source_uuid}` : `file:${file.name}:${idx}:${c.title}`;
          if (existingKeys.has(key)) {
            duplicates++;
            return;
          }
          existingKeys.add(key);
          added.push({ key, c });
        });
        newReports.push({
          name: file.name,
          detected: result.detected,
          count: result.candidates.length - duplicates,
          skipped: result.skipped,
          duplicates,
          error: null,
        });
      } catch (err) {
        newReports.push({ name: file.name, detected: "unknown", count: 0, skipped: 0, duplicates: 0, error: errorMessage(err, "파일을 읽지 못했습니다") });
      }
    }

    setCandidates((prev) => [...prev, ...added]);
    setReports((prev) => [...prev, ...newReports]);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of added) next.add(a.key);
      return next;
    });
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((x) => x.c.title.toLowerCase().includes(q) || x.c.preview.toLowerCase().includes(q));
  }, [candidates, search]);

  const visible = filtered.slice(0, limit);
  const selectedCount = selected.size;

  function toggleOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const x of filtered) next.add(x.key);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function clearCandidates() {
    setCandidates([]);
    setReports([]);
    setSelected(new Set());
    setSearch("");
    setLimit(PAGE_SIZE);
    setImportNote("");
    setImportError("");
  }

  // ---------- 선택 항목 가져오기 ----------
  async function importSelected() {
    const chosen = candidates.filter((x) => selected.has(x.key));
    if (!chosen.length || importing) return;
    setImportError("");
    setImportNote("");
    const progress: ImportProgress = { sent: 0, total: chosen.length, created: 0, skipped: 0 };
    setImporting({ ...progress });
    const importedKeys = new Set<string>();

    try {
      for (let i = 0; i < chosen.length; i += CHUNK_SIZE) {
        const chunk = chosen.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/hq/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: chunk.map((x) => ({
              kind: x.c.kind,
              title: x.c.title,
              content: x.c.content,
              source_uuid: x.c.source_uuid,
              source_date: x.c.source_date,
            })),
          }),
        });
        const data = await parseResponse<{ items: KnowledgeListItem[]; skipped: number }>(res, "가져오지 못했습니다");
        progress.sent += chunk.length;
        progress.created += data.items.length;
        progress.skipped += data.skipped;
        for (const x of chunk) importedKeys.add(x.key);
        setImporting({ ...progress });
      }
      setImportNote(`${progress.created}개 가져옴${progress.skipped ? `, 중복 ${progress.skipped}개 건너뜀` : ""}`);
    } catch (err) {
      setImportError(
        `${errorMessage(err, "가져오지 못했습니다")}${progress.sent ? ` — ${progress.sent}/${progress.total}개까지 처리됨. 남은 항목은 선택 상태로 유지됩니다.` : ""}`
      );
    } finally {
      setImporting(null);
      if (importedKeys.size) {
        setCandidates((prev) => prev.filter((x) => !importedKeys.has(x.key)));
        setSelected((prev) => {
          const next = new Set(prev);
          for (const k of importedKeys) next.delete(k);
          return next;
        });
        setListLoading(true);
        await loadList();
      }
    }
  }

  // ---------- 텍스트 붙여넣기 ----------
  async function submitPaste(e: FormEvent) {
    e.preventDefault();
    if (pasting) return;
    setPasteError("");
    setPasteNote("");
    const candidate = textToCandidate(pasteTitle, pasteText);
    if (!candidate) {
      setPasteError("내용을 입력하세요");
      return;
    }
    setPasting(true);
    try {
      const res = await fetch("/api/hq/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ kind: candidate.kind, title: candidate.title, content: candidate.content }] }),
      });
      const data = await parseResponse<{ items: KnowledgeListItem[]; skipped: number }>(res, "등록하지 못했습니다");
      if (data.items.length) {
        setPasteNote(`「${data.items[0].title}」 등록 완료`);
        setPasteTitle("");
        setPasteText("");
        setItems((prev) => [...data.items, ...prev]);
      } else {
        setPasteError("등록된 항목이 없습니다");
      }
    } catch (err) {
      setPasteError(errorMessage(err, "등록하지 못했습니다"));
    } finally {
      setPasting(false);
    }
  }

  // ---------- 분석 ----------
  /** `recreateTasks=false` on an already-analyzed item refreshes summary/venture without adding tasks again. */
  const analyzeOne = useCallback(async (id: string, recreateTasks = true): Promise<boolean> => {
    setAnalyzing((prev) => new Set(prev).add(id));
    setNotes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    let ok = false;
    try {
      const res = await fetch(`/api/hq/knowledge/${id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create_tasks: recreateTasks }),
      });
      const data = await parseResponse<AnalyzeResponse>(res, "분석하지 못했습니다");
      setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
      const parts = [data.venture ? `사업 「${data.venture.name}」에 연결` : "사업 미지정", `할 일 ${data.tasks.length}개 등록`];
      if (data.skipped_duplicates) parts.push(`이미 있는 할 일 ${data.skipped_duplicates}개 건너뜀`);
      if (data.truncated) parts.push("자료가 길어 앞부분만 분석");
      setNotes((prev) => ({ ...prev, [id]: { tone: "ok", text: parts.join(", ") } }));
      ok = true;
    } catch (err) {
      setNotes((prev) => ({ ...prev, [id]: { tone: "error", text: errorMessage(err, "분석하지 못했습니다") } }));
    } finally {
      setAnalyzing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    return ok;
  }, []);

  const unanalyzed = useMemo(() => items.filter((it) => !it.analyzed), [items]);

  async function analyzeAll() {
    if (batch || !unanalyzed.length) return;
    stopBatchRef.current = false;
    setBatchError("");
    const targets = unanalyzed.map((it) => it.id);
    setBatch({ done: 0, total: targets.length });
    let done = 0;
    const failed: string[] = [];
    for (const id of targets) {
      if (stopBatchRef.current) break;
      const ok = await analyzeOne(id);
      done++;
      setBatch({ done, total: targets.length });
      // Keep going past a bad item so one failure cannot block the whole queue.
      if (!ok) failed.push(items.find((it) => it.id === id)?.title ?? id);
    }
    if (failed.length) {
      setBatchError(`${failed.length}개 자료는 분석하지 못했습니다: ${failed.slice(0, 3).map((t) => `「${t}」`).join(", ")}${failed.length > 3 ? " 외" : ""}. 각 행의 ✦ 분석으로 다시 시도하세요.`);
    }
    setBatch(null);
  }

  function stopBatch() {
    stopBatchRef.current = true;
  }

  async function removeItem(item: KnowledgeListItem) {
    if (!confirm(`「${item.title}」 자료를 삭제할까요?\n분석으로 만든 할 일은 남지만, 이 자료에 남긴 코멘트는 함께 삭제됩니다.`)) return;
    setDeleting((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch(`/api/hq/knowledge/${item.id}`, { method: "DELETE" });
      await parseResponse<{ ok: boolean }>(res, "삭제하지 못했습니다");
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (err) {
      setListError(errorMessage(err, "삭제하지 못했습니다"));
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  const busyAnalyze = analyzing.size > 0 || batch !== null;

  return (
    <div>
      <PageHeader
        title="Claude 가져오기"
        subtitle="Claude.ai → 설정 → 개인정보(Privacy) → 데이터 내보내기(Export data). 이메일로 받은 zip 안의 conversations.json / projects.json을 올리세요."
      />

      {statusError && !status && (
        <div className="bg-gray-100 border border-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg mb-4">{statusError}</div>
      )}
      {status && !status.ai_enabled && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg mb-4">
          AI 비서가 꺼져 있어 분석은 할 수 없습니다. 자료 가져오기는 가능합니다.
          {status.hint ? ` ${status.hint}` : ""}
        </div>
      )}

      {/* ---------- 가져오기 카드 ---------- */}
      <Card className="mb-6">
        <div className="flex gap-1 border-b border-gray-100 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 px-4 sm:px-5 mb-4">
          {(
            [
              { value: "file", label: "파일 업로드" },
              { value: "paste", label: "텍스트 붙여넣기" },
            ] as { value: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cx(
                "px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.value ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "file" ? (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                multiple
                onChange={onFiles}
                disabled={parsing || importing !== null}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                aria-label="Claude 내보내기 JSON 파일 선택"
              />
              {parsing && (
                <span className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
                  <Spinner /> 파일 해석 중...
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">conversations.json, projects.json을 함께 올려도 됩니다. 해석은 브라우저에서 하고, 선택한 항목만 서버로 보냅니다.</p>

            {reports.length > 0 && (
              <ul className="mt-3 space-y-1">
                {reports.map((r, i) => (
                  <li key={`${r.name}-${i}`} className={cx("text-xs rounded-md px-2.5 py-1.5 border", r.error ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-600")}>
                    <span className="font-medium text-gray-800">{r.name}</span>
                    {r.error ? (
                      <> — {r.error}</>
                    ) : (
                      <>
                        {" "}
                        — {DETECTED_LABEL[r.detected]} · {r.count}개 발견
                        {r.skipped ? ` · 비어 있음 ${r.skipped}개 제외` : ""}
                        {r.duplicates ? ` · 이미 목록에 있음 ${r.duplicates}개` : ""}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <ErrorBanner message={importError} onClose={() => setImportError("")} />
            {importNote && (
              <div className="mt-3 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
                {importNote}{" "}
                <button type="button" onClick={() => setImportNote("")} className="text-green-500 hover:text-green-700 ml-1" aria-label="닫기">
                  ✕
                </button>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setLimit(PAGE_SIZE);
                    }}
                    placeholder="제목·내용으로 검색"
                    className="sm:max-w-xs"
                    aria-label="후보 검색"
                  />
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    <Button size="sm" variant="ghost" onClick={selectAllFiltered} disabled={importing !== null}>
                      {search.trim() ? "검색 결과 전체 선택" : "전체 선택"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection} disabled={importing !== null || !selectedCount}>
                      선택 해제
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearCandidates} disabled={importing !== null}>
                      목록 비우기
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs text-gray-500">
                  <span>
                    {filtered.length}개 표시 · {selectedCount}개 선택
                  </span>
                  <Button size="sm" onClick={importSelected} disabled={!selectedCount || importing !== null} loading={importing !== null}>
                    {importing ? `가져오는 중 ${importing.sent}/${importing.total}` : `선택 ${selectedCount}개 가져오기`}
                  </Button>
                </div>
                {importing && (
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-3" role="progressbar" aria-valuenow={importing.sent} aria-valuemin={0} aria-valuemax={importing.total}>
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${importing.total ? Math.round((importing.sent / importing.total) * 100) : 0}%` }} />
                  </div>
                )}

                {filtered.length === 0 ? (
                  <EmptyState title="검색 결과가 없습니다" hint="다른 검색어를 입력해 보세요" />
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {visible.map((x) => {
                      const checked = selected.has(x.key);
                      return (
                        <li key={x.key}>
                          <label className={cx("flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50", checked && "bg-indigo-50/40")}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOne(x.key)}
                              disabled={importing !== null}
                              className="mt-1 h-4 w-4 accent-indigo-600 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-sm text-gray-900 break-words">{x.c.title}</span>
                                <KindBadge kind={x.c.kind} />
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                                {x.c.source_date && <span>{formatDate(x.c.source_date)}</span>}
                                <span>{x.c.kind === "project" ? `문서 ${x.c.message_count}개` : `메시지 ${x.c.message_count}개`}</span>
                                <span>{formatChars(x.c.content.length)}</span>
                              </div>
                              {x.c.preview && <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{x.c.preview}</p>}
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {filtered.length > visible.length && (
                  <div className="flex justify-center mt-3">
                    <Button size="sm" variant="secondary" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                      더 보기 ({filtered.length - visible.length}개 남음)
                    </Button>
                  </div>
                )}
              </div>
            )}

            {candidates.length === 0 && !parsing && reports.length === 0 && (
              <EmptyState title="아직 올린 파일이 없습니다" hint="conversations.json 또는 projects.json을 선택하면 목록이 나타납니다" />
            )}
          </div>
        ) : (
          <form onSubmit={submitPaste} className="space-y-3">
            <Field label="제목" hint="비워 두면 첫 줄을 제목으로 씁니다">
              <Input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="예: 신규 서비스 기획 메모" disabled={pasting} maxLength={200} />
            </Field>
            <Field label="내용">
              <Textarea
                rows={10}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Claude 대화, 회의 메모, 아이디어 등 무엇이든 붙여넣으세요"
                disabled={pasting}
                className="font-mono text-xs"
              />
            </Field>
            <ErrorBanner message={pasteError} onClose={() => setPasteError("")} />
            {pasteNote && <p className="text-sm text-green-700">{pasteNote}</p>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">{formatChars(pasteText.length)}</span>
              <Button type="submit" loading={pasting} disabled={!pasteText.trim()}>
                메모로 등록
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* ---------- 가져온 자료 ---------- */}
      <Card
        title={
          <>
            가져온 자료 <span className="text-gray-400 font-normal text-sm">{items.length}</span>
          </>
        }
        actions={
          batch ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Spinner className="h-3.5 w-3.5" /> {batch.done}/{batch.total}
              </span>
              <Button size="sm" variant="danger" onClick={stopBatch}>
                중지
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={analyzeAll}
              disabled={!aiEnabled || !unanalyzed.length || busyAnalyze}
              title={!aiEnabled ? "AI 비서가 꺼져 있습니다" : ""}
            >
              ✦ 일괄 분석 (미분석 {unanalyzed.length}개)
            </Button>
          )
        }
      >
        <ErrorBanner message={listError} onClose={() => setListError("")} />
        <ErrorBanner message={batchError} onClose={() => setBatchError("")} />
        {listLoading ? (
          <LoadingBlock />
        ) : items.length === 0 ? (
          <EmptyState title="가져온 자료가 없습니다" hint="위에서 Claude 내보내기 파일을 올리거나 텍스트를 붙여넣으세요" />
        ) : (
          <ul className="divide-y divide-gray-100 -mx-4 sm:-mx-5">
            {items.map((it) => {
              const isAnalyzing = analyzing.has(it.id);
              const isDeleting = deleting.has(it.id);
              const note = notes[it.id];
              return (
                <li key={it.id} className="px-4 sm:px-5 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/hq/knowledge/${it.id}`} className="font-medium text-sm text-gray-900 hover:text-indigo-600 break-words">
                          {it.title}
                        </Link>
                        <KindBadge kind={it.kind} />
                        <AnalyzedBadge analyzed={it.analyzed} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
                        {it.venture_id && it.venture_name ? (
                          <Link href={`/hq/ventures/${it.venture_id}`} className="text-gray-500 hover:text-indigo-600">
                            ▣ {it.venture_name}
                          </Link>
                        ) : (
                          <span>사업 미지정</span>
                        )}
                        <span>☑ 할 일 {it.task_count}개</span>
                        <span>{formatChars(it.content_length)}</span>
                        <span>{relativeTime(it.created_at)}</span>
                      </div>
                      {it.summary && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{it.summary}</p>}
                      {note && <p className={cx("mt-1 text-xs", note.tone === "ok" ? "text-green-700" : "text-red-600")}>{note.text}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => analyzeOne(it.id, !it.analyzed)}
                        loading={isAnalyzing}
                        disabled={!aiEnabled || batch !== null || isDeleting}
                        title={!aiEnabled ? "AI 비서가 꺼져 있습니다" : it.analyzed ? "다시 분석 (할 일이 중복될 수 있음)" : "비서가 요약하고 사업·할 일을 뽑아냅니다"}
                      >
                        {isAnalyzing ? "분석 중" : it.analyzed ? "✦ 다시 분석" : "✦ 분석"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeItem(it)} loading={isDeleting} disabled={isAnalyzing || batch !== null} aria-label="삭제" className="text-gray-400 hover:text-red-600">
                        삭제
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
