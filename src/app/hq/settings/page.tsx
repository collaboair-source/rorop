"use client";

// 설정 · 백업: 계정 / AI 비서 상태 / 시간대 / 백업 다운로드 / 백업 복원(전체 교체) / 데이터 위치.
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import type { BackupFile, BackupSummary, StatusResponse } from "@/lib/hq/types";
import { formatDate, formatDateTime, localDateKey } from "@/lib/hq/format";
import { useHqUser } from "@/components/hq/HqUserContext";
import { PageHeader, Card, ErrorBanner, Button, Input, Field, Badge, Spinner, cx } from "@/components/hq/ui";

const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
const CONFIRM_WORD = "REPLACE";

const COLLECTION_LABEL: Record<keyof BackupSummary, string> = {
  ventures: "사업",
  tasks: "할 일",
  comments: "코멘트",
  knowledge: "자료",
  secretary_messages: "비서 대화",
  briefings: "브리핑·주간 회고",
};
const COLLECTION_KEYS = Object.keys(COLLECTION_LABEL) as (keyof BackupSummary)[];

interface LoadedBackup {
  fileName: string;
  fileSize: number;
  backup: BackupFile;
  counts: BackupSummary;
}

interface RestoreResult {
  restored: BackupSummary;
  exported_at: string;
}

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // 본문이 JSON이 아닌 경우 (프록시/런타임 오류 등)
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

/** 파일 내용을 클라이언트에서 1차 검증하고 항목 수를 센다. 서버가 최종 검증한다. */
function inspectBackup(raw: unknown): { backup: BackupFile; counts: BackupSummary } {
  if (!raw || typeof raw !== "object") throw new Error("백업 파일 형식이 아닙니다");
  const p = raw as Partial<BackupFile>;
  if (p.format !== "rorop-hq-backup") throw new Error("Rorop HQ 백업 파일이 아닙니다 (format 불일치)");
  if (p.version !== 1) throw new Error(`지원하지 않는 백업 버전입니다: ${String(p.version)}`);
  if (!p.data || typeof p.data !== "object") throw new Error("백업에 data가 없습니다");
  const data = p.data as Record<string, unknown>;
  const counts = {} as BackupSummary;
  for (const key of COLLECTION_KEYS) {
    const rows = data[key];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`백업의 ${key} 항목이 올바르지 않습니다`);
    counts[key] = Array.isArray(rows) ? rows.length : 0;
  }
  return { backup: p as BackupFile, counts };
}

// 브라우저에서만 알 수 있는 값은 useSyncExternalStore로 읽어 SSR/하이드레이션 불일치를 피한다.
const noopSubscribe = () => () => {};
function readTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}
function readToday(): string {
  return localDateKey();
}
const emptySnapshot = () => "";

function CountGrid({ counts }: { counts: BackupSummary }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {COLLECTION_KEYS.map((key) => (
        <div key={key} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <dt className="text-xs text-gray-500">{COLLECTION_LABEL[key]}</dt>
          <dd className="text-lg font-semibold tabular-nums text-gray-900">{counts[key].toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <dt className="text-sm text-gray-500 sm:w-24 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 min-w-0 break-all">{children}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const user = useHqUser();

  // ---------- AI 비서 상태 ----------
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/status")
      .then((res) => parseResponse<StatusResponse>(res, "AI 상태를 확인하지 못했습니다"))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err) => {
        if (!cancelled) setStatusError(errorMessage(err, "AI 상태를 확인하지 못했습니다"));
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- 시간대 ----------
  const timeZone = useSyncExternalStore(noopSubscribe, readTimeZone, emptySnapshot);
  const today = useSyncExternalStore(noopSubscribe, readToday, emptySnapshot);

  // ---------- 복원 ----------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [loaded, setLoaded] = useState<LoadedBackup | null>(null);
  const [fileError, setFileError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [result, setResult] = useState<RestoreResult | null>(null);

  function resetRestore() {
    setLoaded(null);
    setFileError("");
    setConfirmText("");
    setRestoreError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoaded(null);
    setFileError("");
    setConfirmText("");
    setRestoreError("");
    setResult(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setFileError(`백업 파일이 너무 큽니다 (${formatBytes(file.size)}, 최대 64MB)`);
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error("JSON을 읽지 못했습니다. 백업 다운로드로 받은 .json 파일인지 확인하세요.");
      }
      const { backup, counts } = inspectBackup(raw);
      setLoaded({ fileName: file.name, fileSize: file.size, backup, counts });
    } catch (err) {
      setFileError(errorMessage(err, "파일을 읽지 못했습니다"));
    } finally {
      setReading(false);
    }
  }

  async function onRestore(e: FormEvent) {
    e.preventDefault();
    if (!loaded || confirmText.trim() !== CONFIRM_WORD || restoring) return;
    setRestoring(true);
    setRestoreError("");
    try {
      const res = await fetch("/api/hq/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: loaded.backup, confirm: CONFIRM_WORD }),
      });
      const data = await parseResponse<{ ok: boolean } & RestoreResult>(res, "복원에 실패했습니다");
      setResult({ restored: data.restored, exported_at: data.exported_at });
      setConfirmText("");
    } catch (err) {
      setRestoreError(errorMessage(err, "복원에 실패했습니다"));
    } finally {
      setRestoring(false);
    }
  }

  const aiOn = status?.ai_enabled ?? false;
  const canRestore = !!loaded && confirmText.trim() === CONFIRM_WORD && !restoring && !result;
  const otherOwner = loaded && loaded.backup.user?.email && loaded.backup.user.email !== user.email;
  const totalInFile = loaded ? COLLECTION_KEYS.reduce((sum, k) => sum + loaded.counts[k], 0) : 0;

  return (
    <div>
      <PageHeader title="설정 · 백업" subtitle="계정과 AI 비서 상태를 확인하고, HQ 데이터를 백업하거나 복원합니다." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. 계정 */}
        <Card title="계정">
          <dl>
            <InfoRow label="이름">{user.name}</InfoRow>
            <InfoRow label="이메일">{user.email}</InfoRow>
            <InfoRow label="역할">{user.role === "designer" ? "디자이너" : user.role === "client" ? "클라이언트" : user.role}</InfoRow>
          </dl>
          <p className="text-xs text-gray-400 mt-3">로그아웃은 왼쪽 사이드바 하단에서 할 수 있습니다.</p>
        </Card>

        {/* 2. AI 비서 */}
        <Card
          title="AI 비서"
          actions={
            statusLoading ? (
              <Spinner />
            ) : status ? (
              <Badge className={aiOn ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}>
                {aiOn ? "켜짐" : "꺼짐"}
              </Badge>
            ) : null
          }
        >
          {statusError && <ErrorBanner message={statusError} />}
          {statusLoading ? (
            <p className="text-sm text-gray-400">상태 확인 중...</p>
          ) : status ? (
            <dl>
              <InfoRow label="상태">{aiOn ? "켜짐 · 브리핑, 주간 회고, 사업 점검, 자료 분석, 비서 대화를 사용할 수 있습니다." : "꺼짐"}</InfoRow>
              <InfoRow label="모델">
                <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{status.model}</code>
              </InfoRow>
              {!aiOn && status.hint && (
                <InfoRow label="안내">
                  <span className="text-amber-700">{status.hint}</span>
                </InfoRow>
              )}
            </dl>
          ) : null}
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1.5">
            <p className="font-medium text-gray-700">서버 환경변수</p>
            <p>
              <code className="bg-white border border-gray-200 rounded px-1">ANTHROPIC_API_KEY</code> — Anthropic API 키. 설정하면 AI 비서가 켜집니다.
            </p>
            <p>
              <code className="bg-white border border-gray-200 rounded px-1">SECRETARY_MODEL</code> — 비서가 사용할 모델 이름 (선택).
            </p>
            <p>
              <code className="bg-white border border-gray-200 rounded px-1">HQ_AI_ENABLED</code> — <code>1</code>로 두면 키 없이도 다른 인증 방식으로 켭니다 (선택).
            </p>
            <p className="text-gray-400">변경 후 서버를 재시작해야 반영됩니다.</p>
          </div>
        </Card>

        {/* 3. 시간대 */}
        <Card title="시간대">
          <dl>
            <InfoRow label="시간대">{timeZone || <span className="text-gray-400">확인 중...</span>}</InfoRow>
            <InfoRow label="오늘">{today ? formatDate(today) : <span className="text-gray-400">확인 중...</span>}</InfoRow>
          </dl>
          <p className="text-xs text-gray-400 mt-3">
            서버는 이 시간대를 <code className="bg-gray-100 rounded px-1">hq_tz</code> 쿠키로 받아 &quot;오늘&quot;과 기한 계산에 사용합니다.
          </p>
        </Card>

        {/* 4. 백업 */}
        <Card title="백업">
          <p className="text-sm text-gray-600">
            내 HQ 데이터 전체를 JSON 파일 하나로 내려받습니다. 사업·할 일·코멘트·자료·비서 대화·브리핑·주간 회고가 포함되며, 계정과 비밀번호는 포함되지 않습니다.
          </p>
          <div className="mt-4">
            <a
              href="/api/hq/backup"
              download
              className="inline-flex items-center justify-center gap-1.5 rounded-lg font-medium text-sm px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              ⇩ 백업 다운로드
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-3">복원 전이나 서버 이전 전에 먼저 받아 두세요.</p>
        </Card>

        {/* 5. 복원 */}
        <Card title="복원" className="lg:col-span-2" actions={loaded || fileError || result ? <Button variant="ghost" size="sm" onClick={resetRestore}>다른 파일 선택</Button> : undefined}>
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 mb-4">
            <p className="font-medium">주의: 복원하면 현재 HQ 데이터가 백업 파일 내용으로 전부 교체됩니다.</p>
            <p className="text-xs mt-1">되돌릴 수 없습니다. 진행 전에 위의 &quot;백업 다운로드&quot;로 현재 상태를 먼저 저장하세요.</p>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2">
                <p className="font-medium">복원 완료</p>
                <p className="text-xs mt-1">{formatDateTime(result.exported_at)} 시점의 백업으로 교체했습니다.</p>
              </div>
              <CountGrid counts={result.restored} />
              <div className="flex flex-wrap gap-2">
                <Link href="/hq" className="inline-flex items-center justify-center rounded-lg font-medium text-sm px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  사령부로 이동
                </Link>
                <Button variant="secondary" onClick={resetRestore}>
                  다른 백업 복원
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onRestore} className="space-y-4">
              <Field label="백업 파일 (.json)" hint="&quot;백업 다운로드&quot;로 받은 rorop-hq-backup-*.json 파일을 선택하세요. 최대 64MB.">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={onFile}
                  disabled={reading || restoring}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 disabled:opacity-50"
                />
              </Field>

              {reading && (
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <Spinner /> 파일 읽는 중...
                </p>
              )}
              {fileError && <ErrorBanner message={fileError} onClose={() => setFileError("")} />}

              {loaded && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p className="text-sm font-medium text-gray-900 break-all">{loaded.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {formatBytes(loaded.fileSize)} · 내보낸 시각 {formatDateTime(loaded.backup.exported_at) || "알 수 없음"}
                      </p>
                    </div>
                    {loaded.backup.user?.email && (
                      <p className="text-xs text-gray-500 break-all">
                        백업 계정: {loaded.backup.user.name ? `${loaded.backup.user.name} · ` : ""}
                        {loaded.backup.user.email}
                      </p>
                    )}
                    {otherOwner && (
                      <p className="text-xs text-amber-700">이 백업은 다른 계정({loaded.backup.user.email})에서 내보낸 파일입니다. 복원하면 내 계정 데이터로 들어옵니다.</p>
                    )}
                    <CountGrid counts={loaded.counts} />
                    {totalInFile === 0 && <p className="text-xs text-amber-700">파일에 항목이 없습니다. 복원하면 현재 데이터가 모두 비워집니다.</p>}
                  </div>

                  <Field label={`확인을 위해 ${CONFIRM_WORD} 를 입력하세요`}>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={CONFIRM_WORD}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={restoring}
                      className={cx("sm:max-w-xs font-mono", confirmText && confirmText.trim() !== CONFIRM_WORD && "border-red-300")}
                    />
                  </Field>

                  {restoreError && <ErrorBanner message={restoreError} onClose={() => setRestoreError("")} />}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Button type="submit" variant="danger-solid" disabled={!canRestore} loading={restoring}>
                      {restoring ? "복원 중..." : "이 백업으로 전체 교체"}
                    </Button>
                    {restoring && <span className="text-xs text-gray-500">서버에 업로드하고 교체하는 중입니다. 페이지를 닫지 마세요.</span>}
                  </div>
                </div>
              )}
            </form>
          )}
        </Card>

        {/* 6. 데이터 위치 */}
        <Card title="데이터 위치" className="lg:col-span-2">
          <p className="text-sm text-gray-600">
            HQ 데이터는 서버의 <code className="bg-gray-100 rounded px-1">data/store.json</code> 파일 하나에 저장됩니다. 환경변수{" "}
            <code className="bg-gray-100 rounded px-1">RORO_DATA_DIR</code>를 설정하면 그 폴더 안의 <code className="bg-gray-100 rounded px-1">store.json</code>을 사용합니다.
            {" "}백업 파일에는 계정이 없으므로, 새 서버에서는 먼저 계정을 만들고 이 화면에서 복원하세요. 복원 시 모든 항목은 새 id를 받습니다(기존 링크는 바뀝니다).
          </p>
          <p className="text-xs text-gray-400 mt-2">서버를 옮길 때는 이 파일을 복사하거나, 위의 백업 파일을 새 서버에서 복원하세요.</p>
        </Card>
      </div>
    </div>
  );
}
