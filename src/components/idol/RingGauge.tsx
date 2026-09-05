"use client";

/** 링 게이지 — 반지름 18, 두께 4 (04 문서 3.3). 색은 토큰 문자열(`var(--good)` 등)로 받는다. */

const R = 18;
const STROKE = 4;
const BOX = (R + STROKE) * 2;
const CIRC = 2 * Math.PI * R;

export function RingGauge({
  value,
  max = 100,
  color = "var(--accent)",
  label,
  suffix = "",
  digits = 0,
  size = 52,
}: {
  value: number;
  max?: number;
  color?: string;
  label: string;
  suffix?: string;
  digits?: number;
  size?: number;
}) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${BOX} ${BOX}`}
        role="img"
        aria-label={`${label} ${value.toFixed(digits)}${suffix}`}
        className="shrink-0"
      >
        <circle
          cx={BOX / 2}
          cy={BOX / 2}
          r={R}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={STROKE}
        />
        <circle
          cx={BOX / 2}
          cy={BOX / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${(CIRC * ratio).toFixed(2)} ${CIRC.toFixed(2)}`}
          transform={`rotate(-90 ${BOX / 2} ${BOX / 2})`}
          style={{ transition: "stroke-dasharray 400ms ease-out" }}
        />
      </svg>
      <div className="min-w-0">
        <p className="text-[11px] font-bold leading-4 text-[var(--ink-3)]">{label}</p>
        <p className="num text-[17px] font-extrabold leading-5" style={{ color }}>
          {value.toFixed(digits)}
          <span className="text-[11px] font-bold">{suffix}</span>
        </p>
      </div>
    </div>
  );
}
