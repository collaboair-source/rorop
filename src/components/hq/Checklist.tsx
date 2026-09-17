"use client";

// Editable checklist for a task. All mutations go through PATCH /api/hq/tasks/:id.
import { useState } from "react";
import type { ChecklistItem, TaskWithVenture } from "@/lib/hq/types";
import { Button, Input, cx } from "./ui";

interface Props {
  task: TaskWithVenture;
  onChange: (task: TaskWithVenture) => void;
}

export default function Checklist({ task, onChange }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/hq/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장하지 못했습니다");
      onChange(data.task);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (await patch({ checklist_add: t })) setText("");
  }

  const done = task.checklist.filter((c) => c.done).length;
  const total = task.checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">
          체크리스트{" "}
          <span className="text-gray-400 font-normal text-sm">
            {done}/{total}
          </span>
        </h3>
        {total > 0 && <span className="text-xs text-gray-500">{pct}%</span>}
      </div>
      {total > 0 && (
        <div className="h-1.5 w-full bg-gray-100 rounded-full mb-3 overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <ul className="space-y-1">
        {task.checklist.map((item: ChecklistItem) => (
          <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={item.done}
              disabled={busy}
              onChange={() => patch({ checklist_toggle: item.id })}
              className="h-4 w-4 accent-indigo-600 cursor-pointer"
            />
            <span className={cx("flex-1 text-sm", item.done ? "line-through text-gray-400" : "text-gray-800")}>{item.text}</span>
            <button
              type="button"
              onClick={() => patch({ checklist_remove: item.id })}
              disabled={busy}
              className="text-gray-300 hover:text-red-500 text-xs sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
              aria-label="항목 삭제"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="세부 항목 추가" disabled={busy} />
        <Button type="submit" size="sm" variant="secondary" disabled={!text.trim() || busy}>
          추가
        </Button>
      </form>
    </div>
  );
}
