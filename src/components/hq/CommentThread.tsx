"use client";

// Comment thread for a venture, task or knowledge item. The AI secretary can be
// asked for advice when `onAskSecretary` is provided.
import { useState } from "react";
import type { Comment, CommentTarget } from "@/lib/hq/types";
import { relativeTime } from "@/lib/hq/format";
import { Button, Textarea, RichText, ErrorBanner, cx } from "./ui";

interface Props {
  targetType: CommentTarget;
  targetId: string;
  comments: Comment[];
  /** Functional updater (pass a state setter) so concurrent edits are never overwritten. */
  onChange: (update: (prev: Comment[]) => Comment[]) => void;
  /** When set, shows a "비서에게 조언 요청" button that calls this and appends the returned comment. */
  onAskSecretary?: () => Promise<Comment>;
  aiEnabled?: boolean;
  title?: string;
  /** Label of the ask-secretary button. */
  askLabel?: string;
  /** One-line explanation shown under the header (e.g. what the secretary button does). */
  hint?: string;
}

export default function CommentThread({ targetType, targetId, comments, onChange, onAskSecretary, aiEnabled = true, title = "코멘트", askLabel = "✦ 비서에게 조언 요청", hint }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const [asking, setAsking] = useState(false);

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setError("");
    try {
      const res = await fetch("/api/hq/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "코멘트를 남기지 못했습니다");
      const created: Comment = data.comment;
      onChange((prev) => [...prev, created]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 코멘트를 삭제할까요?")) return;
    setError("");
    try {
      const res = await fetch(`/api/hq/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "코멘트를 삭제하지 못했습니다");
      }
      onChange((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function ask() {
    if (!onAskSecretary) return;
    setAsking(true);
    setError("");
    try {
      const comment = await onAskSecretary();
      onChange((prev) => [...prev, comment]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          {title} <span className="text-gray-400 font-normal text-sm">{comments.length}</span>
        </h3>
        {onAskSecretary && (
          <Button size="sm" variant="secondary" onClick={ask} loading={asking} disabled={!aiEnabled} title={aiEnabled ? "" : "AI 비서가 꺼져 있습니다. ANTHROPIC_API_KEY를 설정하세요."}>
            {askLabel}
          </Button>
        )}
      </div>
      {hint && <p className="text-xs text-gray-500 -mt-1 mb-3">{hint}</p>}
      <ErrorBanner message={error} onClose={() => setError("")} />
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">아직 코멘트가 없습니다. 진행 상황, 결정, 막힌 점을 기록하세요.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cx("rounded-lg border px-3 py-2.5", c.author === "secretary" ? "bg-indigo-50/60 border-indigo-100" : "bg-white border-gray-200")}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={cx("text-xs font-semibold", c.author === "secretary" ? "text-indigo-700" : "text-gray-700")}>
                  {c.author === "secretary" ? "✦ 비서" : "나"}
                </span>
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  {relativeTime(c.created_at)}
                  <button type="button" onClick={() => remove(c.id)} className="hover:text-red-500" aria-label="삭제">
                    ✕
                  </button>
                </span>
              </div>
              <RichText text={c.body} />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <Textarea
          rows={2}
          value={body}
          disabled={posting}
          onChange={(e) => setBody(e.target.value)}
          placeholder="코멘트 남기기 (Ctrl+Enter로 전송)"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit(e);
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={posting} disabled={!body.trim()}>
            남기기
          </Button>
        </div>
      </form>
    </div>
  );
}
