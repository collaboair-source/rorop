// Pure validation / date helpers for the HQ API. No Next.js imports, so this
// module is unit-testable under plain Node (see tests/api-helpers.test.ts).
import { v4 as uuidv4 } from "uuid";
import type { Priority, TaskStatus, VentureStatus, ChecklistItem } from "./types";

// Local copies of the enum lists (type-only imports keep this module runnable under
// plain Node for tests); tests/api-helpers.test.ts asserts they match ./types.
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"];
const VENTURE_STATUSES: VentureStatus[] = ["idea", "active", "paused", "done"];

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}






export const nowIso = () => new Date().toISOString();
export const newId = () => uuidv4();

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function requiredStr(value: unknown, field: string): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new ApiError(400, `${field}을(를) 입력해주세요`);
  return s;
}

export function optionalStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
}

/** Missing (undefined/null/"") → fallback; present but invalid → 400. */
export function parsePriority(value: unknown, fallback: Priority = "P2"): Priority {
  if (value === undefined || value === null || value === "") return fallback;
  if (!PRIORITIES.includes(value as Priority)) throw new ApiError(400, "우선순위는 P0~P3 중 하나여야 합니다");
  return value as Priority;
}

export function parseTaskStatus(value: unknown, fallback: TaskStatus = "todo"): TaskStatus {
  if (value === undefined || value === null || value === "") return fallback;
  if (!TASK_STATUSES.includes(value as TaskStatus)) throw new ApiError(400, "상태는 todo, doing, done 중 하나여야 합니다");
  return value as TaskStatus;
}

export function parseVentureStatus(value: unknown, fallback: VentureStatus = "active"): VentureStatus {
  if (value === undefined || value === null || value === "") return fallback;
  if (!VENTURE_STATUSES.includes(value as VentureStatus)) throw new ApiError(400, "사업 상태는 idea, active, paused, done 중 하나여야 합니다");
  return value as VentureStatus;
}

/** Lenient date normalizer for model output: valid YYYY-MM-DD or null, never throws. */
export function toValidDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

/** Accepts YYYY-MM-DD (or null/"" to clear). Any other value is a 400. */
export function parseDueDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ApiError(400, "기한은 YYYY-MM-DD 형식이어야 합니다");
  const s = value.trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ApiError(400, "기한은 YYYY-MM-DD 형식이어야 합니다");
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new ApiError(400, "존재하지 않는 날짜입니다");
  return s;
}

/** Accepts string[] or ChecklistItem[] and normalizes to ChecklistItem[]. */
export function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const items: ChecklistItem[] = [];
  for (const raw of value) {
    if (typeof raw === "string") {
      const text = raw.trim();
      if (text) items.push({ id: newId(), text, done: false });
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      if (!text) continue;
      items.push({
        id: typeof obj.id === "string" && obj.id ? obj.id : newId(),
        text,
        done: obj.done === true,
      });
    }
  }
  return items;
}

/** Cookie the HQ layout sets with the browser's IANA time zone (e.g. Asia/Seoul). */
export const TZ_COOKIE = "hq_tz";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) in the given IANA zone, or server local time when none. */
export function todayKey(timeZone?: string | null, date = new Date()): string {
  if (timeZone && isValidTimeZone(timeZone)) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}



export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return todayKey(undefined, date);
}
