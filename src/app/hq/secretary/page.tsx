"use client";

// /hq/secretary — chat with the AI secretary, who knows the user's ventures and tasks.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Proposal, SecretaryMessage, StatusResponse } from "@/lib/hq/types";
import { formatDate, dueLabel, relativeTime } from "@/lib/hq/format";
import { useHqUser } from "@/components/hq/HqUserContext";
import { PageHeader, Card, Button, Textarea, ErrorBanner, LoadingBlock, RichText, PriorityBadge, Spinner, cx } from "@/components/hq/ui";

const SUGGESTIONS = ["오늘 뭐부터 해야 해?", "이번 주 우선순위 정리해줘", "지금 사업들 리스크 짚어줘"];
const AI_OFF_HINT = "AI 비서가 꺼져 있습니다. ANTHROPIC_API_KEY를 설정하세요.";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorOf(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

export default function SecretaryPage() {
  const user = useHqUser();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [messages, setMessages] = useState<SecretaryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null); // text of the message being sent
  const [clearing, setClearing] = useState(false);

  const [accepting, setAccepting] = useState<Set<string>>(new Set()); // "messageId:index"
  const [acceptingAll, setAcceptingAll] = useState<string | null>(null); // messageId
  const [acceptError, setAcceptError] = useState<Record<string, string>>({}); // messageId -> error

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const [statusError, setStatusError] = useState("");
  const aiEnabled = status?.ai_enabled ?? true;
  const sending = pending !== null;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [statusRes, messagesRes] = await Promise.all([fetch("/api/hq/status"), fetch("/api/hq/secretary/messages")]);
      const statusData = await readJson(statusRes);
      const messagesData = await readJson(messagesRes);
      if (!messagesRes.ok) throw new Error(errorOf(messagesData, "대화를 불러오지 못했습니다"));
      if (statusRes.ok) {
        setStatus(statusData as unknown as StatusResponse);
      } else {
        // Unknown ≠ disabled: leave the composer usable; the server answers 503 if AI is really off.
        setStatus(null);
        setStatusError(errorOf(statusData, "AI 상태를 확인하지 못했습니다."));
      }
      setMessages(Array.isArray(messagesData.messages) ? (messagesData.messages as SecretaryMessage[]) : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || sending || !aiEnabled) return;
    setSendError("");
    setPending(text);
    setDraft("");
    try {
      const res = await fetch("/api/hq/secretary/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorOf(data, "비서가 답하지 못했습니다"));
      const userMessage = data.user_message as SecretaryMessage;
      const secretaryMessage = data.secretary_message as SecretaryMessage;
      setMessages((prev) => [...prev, userMessage, secretaryMessage]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
      setDraft(text); // keep the draft so the user can retry
    } finally {
      setPending(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function fillSuggestion(text: string) {
    setDraft(text);
    composerRef.current?.querySelector("textarea")?.focus();
  }

  async function clearConversation() {
    if (messages.length === 0) return;
    if (!confirm("대화 내용을 모두 지울까요? 등록한 할 일은 그대로 남습니다.")) return;
    setClearing(true);
    setSendError("");
    try {
      const res = await fetch("/api/hq/secretary/messages", { method: "DELETE" });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorOf(data, "대화를 지우지 못했습니다"));
      setMessages([]);
      setAcceptError({});
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearing(false);
    }
  }

  function applyProposal(messageId: string, index: number, proposal: Proposal) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposals: m.proposals.map((p, i) => (i === index ? { ...p, ...proposal } : p)) } : m))
    );
  }

  async function acceptOne(messageId: string, index: number): Promise<boolean> {
    const key = `${messageId}:${index}`;
    setAccepting((prev) => new Set(prev).add(key));
    setAcceptError((prev) => ({ ...prev, [messageId]: "" }));
    try {
      const res = await fetch("/api/hq/secretary/proposals/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, index }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorOf(data, "할 일을 등록하지 못했습니다"));
      const proposal = data.proposal as Proposal;
      const task = data.task as { id: string } | undefined;
      applyProposal(messageId, index, { ...proposal, accepted: true, task_id: proposal.task_id ?? task?.id ?? null });
      return true;
    } catch (err) {
      setAcceptError((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : String(err) }));
      return false;
    } finally {
      setAccepting((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function acceptAll(message: SecretaryMessage) {
    setAcceptingAll(message.id);
    try {
      for (let i = 0; i < message.proposals.length; i++) {
        if (message.proposals[i].accepted) continue;
        const ok = await acceptOne(message.id, i);
        if (!ok) break;
      }
    } finally {
      setAcceptingAll(null);
    }
  }

  const composerDisabled = !aiEnabled || sending || loading || !!loadError;

  return (
    <div>
      <PageHeader
        title="✦ 비서"
        subtitle="사업과 할 일을 아는 나만의 수석 비서"
        actions={
          <Button variant="ghost" size="sm" onClick={clearConversation} loading={clearing} disabled={messages.length === 0 || sending}>
            대화 지우기
          </Button>
        }
      />

      {statusError && !status && <div className="bg-gray-100 border border-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg mb-4">{statusError}</div>}
      {status && !status.ai_enabled && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 whitespace-pre-line">
          {status.hint || AI_OFF_HINT}
        </div>
      )}

      <ErrorBanner message={loadError} onClose={() => setLoadError("")} />
      {loadError && (
        <div className="mb-4">
          <Button variant="secondary" size="sm" onClick={load}>
            다시 불러오기
          </Button>
        </div>
      )}

      <Card className="flex flex-col overflow-hidden">
        <div ref={listRef} className="min-h-[50vh] max-h-[calc(100vh-22rem)] overflow-y-auto -m-4 sm:-m-5 p-4 sm:p-5">
          {loading ? (
            <LoadingBlock label="대화 불러오는 중..." />
          ) : messages.length === 0 && !sending ? (
            <div className="flex h-full min-h-[46vh] flex-col items-center justify-center text-center px-2">
              <div className="text-3xl text-indigo-500">✦</div>
              <p className="mt-3 text-base font-medium text-gray-700">{user.name}님, 무엇을 도울까요?</p>
              <p className="mt-1 text-sm text-gray-400">사업 현황과 할 일을 바탕으로 답하고, 필요하면 할 일을 제안합니다.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => fillSuggestion(s)}
                    disabled={!aiEnabled}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((m) => (
                <li key={m.id}>
                  {m.role === "user" ? (
                    <UserBubble content={m.content} time={relativeTime(m.created_at)} />
                  ) : (
                    <SecretaryBubble
                      message={m}
                      accepting={accepting}
                      acceptingAll={acceptingAll === m.id}
                      error={acceptError[m.id] || ""}
                      onAccept={(index) => acceptOne(m.id, index)}
                      onAcceptAll={() => acceptAll(m)}
                      onCloseError={() => setAcceptError((prev) => ({ ...prev, [m.id]: "" }))}
                    />
                  )}
                </li>
              ))}
              {sending && pending && (
                <>
                  <li>
                    <UserBubble content={pending} time="전송 중" />
                  </li>
                  <li>
                    <div className="flex items-start gap-2">
                      <span className="mt-1 text-indigo-500">✦</span>
                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-700">
                        <Spinner className="h-3.5 w-3.5" /> 생각 중…
                      </div>
                    </div>
                  </li>
                </>
              )}
            </ul>
          )}
        </div>

        <div className="mt-4 sm:mt-5 border-t border-gray-100 pt-4 -mx-4 sm:-mx-5 px-4 sm:px-5">
          <ErrorBanner message={sendError} onClose={() => setSendError("")} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex flex-col sm:flex-row gap-2 sm:items-end"
          >
            <div ref={composerRef} className="min-w-0 flex-1">
            <Textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={composerDisabled}
              placeholder={aiEnabled ? "비서에게 물어보기 (Enter 전송 · Shift+Enter 줄바꿈)" : "AI 비서가 꺼져 있어 보낼 수 없습니다"}
              className="resize-none"
              aria-label="메시지"
            />
            </div>
            <Button type="submit" loading={sending} disabled={composerDisabled || !draft.trim()} className="sm:w-28">
              {sending ? "생각 중…" : "보내기"}
            </Button>
          </form>
          {messages.length > 0 && !sending && aiEnabled && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => fillSuggestion(s)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-indigo-300 hover:text-indigo-600">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function UserBubble({ content, time }: { content: string; time: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm text-white whitespace-pre-wrap break-words">{content}</div>
      <span className="mt-1 text-[11px] text-gray-400">{time}</span>
    </div>
  );
}

function SecretaryBubble({
  message,
  accepting,
  acceptingAll,
  error,
  onAccept,
  onAcceptAll,
  onCloseError,
}: {
  message: SecretaryMessage;
  accepting: Set<string>;
  acceptingAll: boolean;
  error: string;
  onAccept: (index: number) => void;
  onAcceptAll: () => void;
  onCloseError: () => void;
}) {
  const proposals = message.proposals ?? [];
  const remaining = proposals.filter((p) => !p.accepted).length;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 shrink-0 text-indigo-500">✦</span>
      <div className="min-w-0 max-w-[92%] sm:max-w-[80%]">
        <div className="rounded-2xl rounded-tl-sm border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <RichText text={message.content} />
        </div>
        {proposals.length > 0 && (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-700">
                제안된 할 일 <span className="font-normal text-gray-400">{proposals.length}</span>
              </span>
              {remaining > 0 && (
                <Button size="sm" variant="secondary" onClick={onAcceptAll} loading={acceptingAll} disabled={accepting.size > 0 && !acceptingAll}>
                  모두 등록 ({remaining})
                </Button>
              )}
            </div>
            {error && (
              <div className="px-3 pt-3">
                <ErrorBanner message={error} onClose={onCloseError} />
              </div>
            )}
            <ul className="divide-y divide-gray-100">
              {proposals.map((p, i) => {
                const busy = accepting.has(`${message.id}:${i}`);
                return (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-start gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={cx("text-sm font-medium leading-snug", p.accepted ? "text-gray-400" : "text-gray-900")}>{p.title}</p>
                      {p.description && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{p.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                        <PriorityBadge priority={p.priority} />
                        {p.due_date && (
                          <span>
                            {formatDate(p.due_date)} · {dueLabel(p.due_date)}
                          </span>
                        )}
                        {p.venture_name ? (
                          p.venture_id ? (
                            <Link href={`/hq/ventures/${p.venture_id}`} className="hover:text-indigo-600">
                              ▣ {p.venture_name}
                            </Link>
                          ) : (
                            <span className="text-purple-700">▣ 새 사업: {p.venture_name}</span>
                          )
                        ) : (
                          <span className="text-gray-400">사업 미지정</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 sm:pt-0.5">
                      {p.accepted ? (
                        p.task_id ? (
                          <Link href={`/hq/tasks/${p.task_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline">
                            등록됨 ✓
                          </Link>
                        ) : (
                          <span className="text-xs font-medium text-green-700">등록됨 ✓</span>
                        )
                      ) : (
                        <Button size="sm" onClick={() => onAccept(i)} loading={busy} disabled={acceptingAll && !busy}>
                          등록
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <span className="mt-1 block text-[11px] text-gray-400">{relativeTime(message.created_at)}</span>
      </div>
    </div>
  );
}
