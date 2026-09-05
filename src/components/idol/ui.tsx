"use client";

/**
 * 프리미티브 — Button / Chip / Card / Sheet / ConfirmDialog / Icon.
 * 리터럴 색을 쓰지 않고 idol.css 의 토큰(`var(--…)`)만 참조한다. 그래야 같은 컴포넌트가
 * 백스테이지와 온스테이지 양쪽에서 그대로 맞는다.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// 아이콘 — 인라인 SVG 선 아이콘 12종 (1.75px, 라운드 캡)
// ---------------------------------------------------------------------------

export type IconName =
  | "menu"
  | "close"
  | "back"
  | "save"
  | "album"
  | "settings"
  | "plus"
  | "check"
  | "warn"
  | "star"
  | "heart"
  | "play";

const PATHS: Record<IconName, ReactNode> = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  back: (
    <>
      <path d="M14 6l-6 6 6 6" />
    </>
  ),
  save: (
    <>
      <path d="M5 5h11l3 3v11H5z" />
      <path d="M9 5v5h6V5" />
      <path d="M8 19v-5h8v5" />
    </>
  ),
  album: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: (
    <>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </>
  ),
  warn: (
    <>
      <path d="M12 4l8.5 15h-17z" />
      <path d="M12 10v4" />
      <path d="M12 16.6v.2" />
    </>
  ),
  star: (
    <>
      <path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z" />
    </>
  ),
  heart: (
    <>
      <path d="M12 19s-6.5-4-6.5-8.4A3.6 3.6 0 0 1 12 8.4a3.6 3.6 0 0 1 6.5 2.2C18.5 15 12 19 12 19z" />
    </>
  ),
  play: (
    <>
      <path d="M8 5.5l10 6.5-10 6.5z" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 버튼
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--on-accent)] font-extrabold border border-[var(--accent)] hover:brightness-105 active:brightness-95",
  secondary:
    "bg-[var(--surface)] text-[var(--ink)] font-bold border border-[var(--line)] hover:bg-[var(--surface-2)]",
  ghost:
    "bg-transparent text-[var(--accent-ink)] font-bold border border-transparent hover:bg-[var(--accent-soft)]",
  danger:
    "bg-transparent text-[var(--bad)] font-bold border border-[var(--line)] hover:bg-[var(--surface-2)]",
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  full = false,
  small = false,
  className = "",
  title,
  "aria-label": ariaLabel,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  className?: string;
  title?: string;
  "aria-label"?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      data-testid={testId}
      className={[
        // 터치 타깃은 작은 버튼도 44px 이상
        "inline-flex items-center justify-center gap-1.5 rounded-[14px] transition-[background-color,box-shadow,color] duration-[120ms]",
        small ? "min-h-[44px] px-3.5 text-[13px]" : "min-h-[52px] px-5 text-[15px]",
        full ? "w-full" : "",
        VARIANT[variant],
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 칩 · 필
// ---------------------------------------------------------------------------

export type ChipTone = "neutral" | "accent" | "good" | "bad" | "warn" | "gold";

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "bg-[var(--surface-2)] text-[var(--ink-2)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  good: "bg-[var(--surface-2)] text-[var(--good)]",
  bad: "bg-[var(--surface-2)] text-[var(--bad)]",
  warn: "bg-[var(--surface-2)] text-[var(--warn)]",
  gold: "bg-[var(--surface-2)] text-[var(--gold)]",
};

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={[
        "num inline-flex h-[26px] items-center gap-1 rounded-full px-2.5 text-[12px] font-bold leading-none",
        CHIP_TONE[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/** 증가는 --good, 감소는 --bad. 0 이면 숨긴다 */
export function Delta({
  value,
  digits = 0,
  suffix = "",
  hideZero = true,
  label,
}: {
  value: number;
  digits?: number;
  suffix?: string;
  hideZero?: boolean;
  label?: string;
}) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0 && hideZero) return null;
  const tone = rounded > 0 ? "text-[var(--good)]" : rounded < 0 ? "text-[var(--bad)]" : "text-[var(--ink-3)]";
  return (
    <span className={`num text-[12px] font-bold ${tone}`}>
      {label ? <span className="mr-1 font-medium text-[var(--ink-3)]">{label}</span> : null}
      {rounded > 0 ? "+" : rounded < 0 ? "−" : ""}
      {Math.abs(rounded).toLocaleString("ko-KR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 카드 · 섹션
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[20px] border border-[var(--line)] bg-[var(--surface)]",
        padded ? "p-3.5" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-3)]">
        {children}
      </h2>
      {right ? <div className="text-[12px] text-[var(--ink-2)]">{right}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 오버레이 · 바텀시트 · 확인 다이얼로그
// ---------------------------------------------------------------------------

export function Overlay({
  children,
  onClose,
  align = "center",
  labelledBy,
  className = "",
}: {
  children: ReactNode;
  onClose?: () => void;
  align?: "center" | "bottom";
  labelledBy?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 flex justify-center ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        onClick={onClose}
        className={[
          "absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]",
          onClose ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
      />
      <div
        className={[
          "relative flex w-full max-w-[480px] flex-col px-3",
          align === "bottom" ? "justify-end pb-3" : "justify-center py-6",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Overlay onClose={onClose} align="bottom" labelledBy="idol-sheet-title">
      <div className="idol-sheet-up flex max-h-[84vh] flex-col overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow)]">
        <div className="flex flex-col items-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-[var(--line)]" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-2">
          <div className="min-w-0">
            <h2 id="idol-sheet-title" className="truncate text-[17px] font-extrabold text-[var(--ink)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate text-[12px] text-[var(--ink-2)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="idol-no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-[var(--line)] bg-[var(--surface)] p-3">{footer}</div>
        ) : null}
      </div>
    </Overlay>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Overlay onClose={onCancel} labelledBy="idol-confirm-title">
      <div className="idol-fade-up rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
        <h2 id="idol-confirm-title" className="text-[17px] font-extrabold text-[var(--ink)]">
          {title}
        </h2>
        {message ? (
          <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-[var(--ink-2)]">
            {message}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button full variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            full
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            testId="confirm-ok"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
