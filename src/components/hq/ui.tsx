"use client";

// Small presentational building blocks shared by every HQ page.
import Link from "next/link";
import type { ReactNode, ComponentProps } from "react";
import type { Priority, TaskStatus, VentureStatus } from "@/lib/hq/types";
import { PRIORITY_LABEL, TASK_STATUS_LABEL, VENTURE_STATUS_LABEL } from "@/lib/hq/types";
import { PRIORITY_CLASS, TASK_STATUS_CLASS, VENTURE_STATUS_CLASS, dueLabel, daysUntil } from "@/lib/hq/format";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------- layout ----------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("bg-white rounded-xl border border-gray-200 shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4 text-gray-400">
      <p className="text-base font-medium text-gray-500">{title}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600 align-middle", className)}
      aria-label="로딩 중"
    />
  );
}

export function LoadingBlock({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
      <span className="whitespace-pre-line">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-red-400 hover:text-red-600 shrink-0" aria-label="닫기">
          ✕
        </button>
      )}
    </div>
  );
}

export function StatTile({ label, value, tone = "default", href }: { label: string; value: ReactNode; tone?: "default" | "danger" | "success" | "accent"; href?: string }) {
  const toneClass =
    tone === "danger" ? "text-red-600" : tone === "success" ? "text-green-600" : tone === "accent" ? "text-indigo-600" : "text-gray-900";
  const body = (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-full">
      <div className={cx("text-2xl font-bold tabular-nums", toneClass)}>{value}</div>
      <div className="text-xs sm:text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:-translate-y-0.5 transition-transform">
      {body}
    </Link>
  ) : (
    body
  );
}

// ---------- form controls ----------

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
  const sizes = size === "sm" ? "text-xs px-2.5 py-1.5" : "text-sm px-4 py-2";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
    "danger-solid": "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  const spinner = variant === "primary" || variant === "danger-solid" ? "border-white/40 border-t-white" : "border-gray-300 border-t-gray-700";
  return (
    <button className={cx(base, sizes, variants, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className={cx("h-3.5 w-3.5", spinner)} />}
      {children}
    </button>
  );
}

const fieldClass = "min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50";

/** Fields are full-width unless the caller passes its own width/flex sizing. */
function fieldWidth(className?: string): string {
  return className && /(^|\s)(w-|max-w-|flex-1|flex-auto|basis-|grow)/.test(className) ? "" : "w-full";
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(fieldClass, fieldWidth(className), className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldClass, fieldWidth(className), className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cx(fieldClass, fieldWidth(className), className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

// ---------- badges ----------

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>{children}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge className={PRIORITY_CLASS[priority]}>
      {priority} · {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={TASK_STATUS_CLASS[status]}>{TASK_STATUS_LABEL[status]}</Badge>;
}

export function VentureStatusBadge({ status }: { status: VentureStatus }) {
  return <Badge className={VENTURE_STATUS_CLASS[status]}>{VENTURE_STATUS_LABEL[status]}</Badge>;
}

export function DueBadge({ dueDate, done }: { dueDate: string | null; done?: boolean }) {
  if (!dueDate) return null;
  const n = daysUntil(dueDate);
  const label = dueLabel(dueDate);
  const cls = done
    ? "bg-gray-50 text-gray-400 border-gray-200"
    : n !== null && n < 0
    ? "bg-red-50 text-red-600 border-red-200"
    : n === 0
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <Badge className={cls}>
      {dueDate.slice(5).replace("-", "/")} · {label}
    </Badge>
  );
}

export function SourceBadge({ source }: { source: "manual" | "claude" | "secretary" }) {
  if (source === "manual") return null;
  return (
    <Badge className={source === "claude" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}>
      {source === "claude" ? "Claude에서 가져옴" : "비서 제안"}
    </Badge>
  );
}

/** Minimal markdown-ish renderer: paragraphs, bullets, **bold**. Safe (no HTML injection). */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cx("space-y-2 text-sm leading-relaxed text-gray-800", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l) || !l.trim());
        if (isList) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.filter((l) => l.trim()).map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        const heading = block.match(/^#{1,3}\s+(.*)$/);
        if (heading && lines.length === 1) {
          return (
            <p key={i} className="font-semibold text-gray-900">
              {inline(heading[1])}
            </p>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {lines.map((l, j) => (
              <span key={j}>
                {inline(l.replace(/^#{1,3}\s+/, ""))}
                {j < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-gray-900">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
