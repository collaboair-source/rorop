"use client";

/**
 * 소형 UI 프리미티브 (TECH_SPEC 6.2 / 6.3).
 * 팔레트: 배경 #0B1020, 카드 #141B33, 텍스트 #EEF0FF, 라벤더 #A78BFA, 민트 #5EEAD4, 경고 #F87171.
 * 터치 타깃은 44px 이상.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import { BG_FALLBACK_GRADIENT } from "@/game/idol/assets";

export const COLOR = {
  bg: "#0B1020",
  card: "#141B33",
  text: "#EEF0FF",
  lavender: "#A78BFA",
  mint: "#5EEAD4",
  warn: "#F87171",
  orange: "#FBBF24",
  muted: "#98A2CC",
  line: "#242E52",
} as const;

// ---------------------------------------------------------------------------
// 버튼
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-[#A78BFA] text-[#160E2E] font-bold border border-[#A78BFA] hover:bg-[#B9A3FB] active:bg-[#8F6EF5]",
  secondary:
    "bg-[#1B2444] text-[#EEF0FF] border border-[#2C3766] hover:bg-[#222D57] active:bg-[#1A2340]",
  ghost:
    "bg-transparent text-[#C7CCEB] border border-transparent hover:bg-[#161E3A] active:bg-[#131A32]",
  danger:
    "bg-[#3A1C24] text-[#F87171] border border-[#5A2733] hover:bg-[#4A222C] active:bg-[#361A22]",
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
        // 터치 타깃은 작은 버튼도 44px 이상 (GDD 12.3 / TECH_SPEC 6.3)
        "inline-flex items-center justify-center gap-1.5 rounded-xl transition-colors duration-150",
        small ? "min-h-[44px] px-3 text-[13px]" : "min-h-[48px] px-4 text-[14px]",
        full ? "w-full" : "",
        VARIANT_CLASS[variant],
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      {children}
    </button>
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
        "rounded-2xl border border-[#242E52] bg-[#141B33]",
        padded ? "p-3" : "",
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
      <h2 className="text-[13px] font-bold tracking-wide text-[#A78BFA]">{children}</h2>
      {right ? <div className="text-[12px] text-[#98A2CC]">{right}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  color = COLOR.lavender,
  filled = false,
}: {
  children: ReactNode;
  color?: string;
  filled?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5"
      style={
        filled
          ? { backgroundColor: color, color: "#0B1020" }
          : { border: `1px solid ${color}55`, color, backgroundColor: `${color}18` }
      }
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 바 · 수치
// ---------------------------------------------------------------------------

export function Bar({
  value,
  max = 100,
  color = COLOR.lavender,
  height = 8,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: "#0E1533" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

/** 증가 민트 / 감소 붉은색 */
export function Delta({
  value,
  digits = 0,
  suffix = "",
  hideZero = true,
}: {
  value: number;
  digits?: number;
  suffix?: string;
  hideZero?: boolean;
}) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0 && hideZero) return null;
  const positive = rounded > 0;
  return (
    <span
      className="text-[12px] font-semibold tabular-nums"
      style={{ color: positive ? COLOR.mint : COLOR.warn }}
    >
      {positive ? "+" : "−"}
      {Math.abs(rounded).toLocaleString("ko-KR")}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 오버레이 (모달 · 하단 시트 · 확인)
// ---------------------------------------------------------------------------

export function Overlay({
  children,
  onClose,
  align = "center",
  labelledBy,
}: {
  children: ReactNode;
  onClose?: () => void;
  align?: "center" | "bottom";
  labelledBy?: string;
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
      className="fixed inset-0 z-40 flex justify-center"
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
          "absolute inset-0 bg-black/65 backdrop-blur-[2px]",
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
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Overlay onClose={onClose} align="bottom" labelledBy="idol-sheet-title">
      <div className="idol-sheet-up flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-[#2C3766] bg-[#101736] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#242E52] px-3 py-2">
          <h2 id="idol-sheet-title" className="text-[15px] font-bold">
            {title}
          </h2>
          <Button variant="ghost" small onClick={onClose} aria-label="닫기">
            닫기
          </Button>
        </div>
        <div className="idol-no-scrollbar flex-1 overflow-y-auto overscroll-contain p-3">
          {children}
        </div>
        {footer ? <div className="border-t border-[#242E52] p-3">{footer}</div> : null}
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
      <div className="idol-fade-up rounded-2xl border border-[#2C3766] bg-[#141B33] p-4 shadow-2xl">
        <h2 id="idol-confirm-title" className="text-[15px] font-bold">
          {title}
        </h2>
        {message ? (
          <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-[#C7CCEB]">{message}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button full variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button full variant={danger ? "danger" : "primary"} onClick={onConfirm} testId="confirm-ok">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// 기타
// ---------------------------------------------------------------------------

/** 장면 이미지가 없을 때 쓰는 폴백 (그라데이션 + 아이콘 + 라벨) */
export function SceneFallback({ icon, label }: { icon?: string; label?: string }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1"
      style={{
        background: [
          "radial-gradient(120% 110% at 18% 0%, rgba(167,139,250,0.30), transparent 62%)",
          "radial-gradient(110% 100% at 92% 100%, rgba(94,234,212,0.18), transparent 58%)",
          BG_FALLBACK_GRADIENT,
        ].join(", "),
      }}
    >
      {icon ? (
        <span className="text-[26px] leading-none opacity-70" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {label ? (
        <span className="text-[10.5px] tracking-[0.22em] text-[#98A2CC]">{label}</span>
      ) : null}
    </div>
  );
}

