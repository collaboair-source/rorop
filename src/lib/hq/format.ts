// Formatting helpers usable on both server and client.
import type { Priority, TaskStatus, VentureStatus } from "./types";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function relativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = now.getTime() - d.getTime();
  if (Number.isNaN(diff)) return "";
  const min = Math.round(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}일 전`;
  return formatDate(iso);
}

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Days from today to a YYYY-MM-DD date (negative = overdue). */
export function daysUntil(dueDate: string | null | undefined, today = localDateKey()): number | null {
  if (!dueDate) return null;
  const a = new Date(`${today}T00:00:00`);
  const b = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function dueLabel(dueDate: string | null | undefined): string {
  const n = daysUntil(dueDate);
  if (n === null) return "";
  if (n < 0) return `${-n}일 지남`;
  if (n === 0) return "오늘";
  if (n === 1) return "내일";
  return `D-${n}`;
}

export const PRIORITY_CLASS: Record<Priority, string> = {
  P0: "bg-red-100 text-red-700 border-red-200",
  P1: "bg-orange-100 text-orange-700 border-orange-200",
  P2: "bg-blue-100 text-blue-700 border-blue-200",
  P3: "bg-gray-100 text-gray-600 border-gray-200",
};

export const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-700 border-gray-200",
  doing: "bg-indigo-100 text-indigo-700 border-indigo-200",
  done: "bg-green-100 text-green-700 border-green-200",
};

export const VENTURE_STATUS_CLASS: Record<VentureStatus, string> = {
  idea: "bg-purple-100 text-purple-700 border-purple-200",
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  done: "bg-gray-100 text-gray-600 border-gray-200",
};

export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}
