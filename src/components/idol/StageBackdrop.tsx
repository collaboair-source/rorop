"use client";

/**
 * 온스테이지 배경 — 조명 빔 + 별 입자 (04 문서 1.5 / 2.3).
 * 빔은 CSS(.beam-*), 입자는 Canvas. prefers-reduced-motion 이면 입자를 한 번만 그린다.
 */

import { useEffect, useRef } from "react";

export function StageBackdrop({
  beams = 3,
  particles = 70,
  floor = true,
  className = "",
}: {
  beams?: 0 | 2 | 3;
  particles?: number;
  floor?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || particles <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 별 색은 토큰에서 읽는다 (Canvas 라 CSS 변수를 직접 못 쓴다)
    const starColor =
      getComputedStyle(canvas).getPropertyValue("--on-media").trim() || "#ffffff";

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let seed = 424242;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const stars = Array.from({ length: particles }, () => ({
      x: rnd() * w,
      y: rnd() * h,
      r: 0.5 + rnd() * 1.6,
      a: 0.25 + rnd() * 0.6,
      drift: 3 + rnd() * 10,
      phase: rnd() * Math.PI * 2,
    }));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const twinkle = reduced ? 1 : 0.65 + 0.35 * Math.sin(t / 900 + s.phase);
        const y = reduced ? s.y : (s.y + ((t / 1000) * s.drift) / 3) % h;
        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = starColor;
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      draw(0);
      return;
    }
    let raf = 0;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [particles]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {beams >= 2 ? <div className="beam beam-a idol-beam-in" /> : null}
      {beams >= 3 ? <div className="beam beam-b idol-beam-in" /> : null}
      {beams >= 2 ? <div className="beam beam-c idol-beam-in" /> : null}
      {particles > 0 ? <canvas ref={ref} className="absolute inset-0 h-full w-full" /> : null}
      {floor ? <div className="stage-floor" /> : null}
    </div>
  );
}
