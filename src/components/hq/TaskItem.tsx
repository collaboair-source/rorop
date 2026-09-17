"use client";

// One task row: status checkbox, title, venture, priority, due date.
import Link from "next/link";
import { useState } from "react";
import type { TaskWithVenture, TaskStatus } from "@/lib/hq/types";
import { PriorityBadge, DueBadge, SourceBadge, cx } from "./ui";

interface Props {
  task: TaskWithVenture;
  onChange?: (task: TaskWithVenture) => void;
  showVenture?: boolean;
  compact?: boolean;
}

export async function patchTask(id: string, body: Record<string, unknown>): Promise<TaskWithVenture> {
  const res = await fetch(`/api/hq/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "저장하지 못했습니다");
  return data.task as TaskWithVenture;
}

export default function TaskItem({ task, onChange, showVenture = true, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const done = task.status === "done";
  const checklistDone = task.checklist.filter((c) => c.done).length;

  async function toggle() {
    if (!onChange) return;
    const next: TaskStatus = done ? "todo" : "done";
    setBusy(true);
    try {
      onChange(await patchTask(task.id, { status: next }));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function cycleStatus() {
    if (!onChange || done) return;
    setBusy(true);
    try {
      onChange(await patchTask(task.id, { status: task.status === "todo" ? "doing" : "todo" }));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx("flex items-start gap-3 rounded-lg border bg-white px-3 transition-colors", compact ? "py-2" : "py-3", done ? "border-gray-100 opacity-70" : "border-gray-200 hover:border-indigo-300")}>
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        disabled={busy || !onChange}
        className="mt-1 h-4 w-4 accent-indigo-600 cursor-pointer shrink-0"
        aria-label={done ? "완료 취소" : "완료로 표시"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/hq/tasks/${task.id}`} className={cx("font-medium text-sm leading-snug hover:text-indigo-600", done ? "line-through text-gray-400" : "text-gray-900")}>
            {task.title}
          </Link>
          {task.status === "doing" && !done && (
            <span className="shrink-0 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">진행 중</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          <DueBadge dueDate={task.due_date} done={done} />
          {showVenture && task.venture_id && (
            <Link href={`/hq/ventures/${task.venture_id}`} className="text-xs text-gray-500 hover:text-indigo-600 truncate max-w-[12rem]">
              ▣ {task.venture_name}
            </Link>
          )}
          {task.checklist.length > 0 && (
            <span className="text-xs text-gray-400">
              ☑ {checklistDone}/{task.checklist.length}
            </span>
          )}
          <SourceBadge source={task.source} />
          {!done && onChange && !compact && (
            <button onClick={cycleStatus} disabled={busy} className="text-xs text-gray-400 hover:text-indigo-600 ml-auto">
              {task.status === "todo" ? "시작 →" : "← 대기로"}
            </button>
          )}
        </div>
        {!compact && task.description && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{task.description}</p>}
      </div>
    </div>
  );
}
