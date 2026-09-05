"use client";

/** 숫자 카운트업 400ms (04 문서 1.5). prefers-reduced-motion 이면 즉시 최종값. */

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({
  value,
  digits = 0,
  duration = 400,
  format,
  className = "",
}: {
  value: number;
  digits?: number;
  duration?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const frame = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || duration <= 0) {
      setShown(value);
      return;
    }
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  const text = format
    ? format(shown)
    : shown.toLocaleString("ko-KR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

  return <span className={`num ${className}`}>{text}</span>;
}
