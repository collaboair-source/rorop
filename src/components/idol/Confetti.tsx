"use client";

/**
 * 컨페티 — Canvas 2D, 파티클 120개, 2.5s (04 문서 1.5).
 * 색은 토큰(--accent / --gold / --ink)에서 읽는다. prefers-reduced-motion 이면 렌더하지 않는다.
 */

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
}

const COUNT = 120;
const DURATION = 2500;

export function Confetti({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 색은 토큰에서 읽는다 (Canvas 라 CSS 변수를 직접 못 쓴다)
    const style = getComputedStyle(canvas);
    const token = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    const palette = [
      token("--accent", "#FF6B8A"),
      token("--gold", "#D9A93A"),
      token("--on-media", "#FFFFFF"),
    ];

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let seed = 20260905;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const parts: Particle[] = Array.from({ length: COUNT }, () => ({
      x: rnd() * w,
      y: -rnd() * h * 0.6,
      vx: (rnd() - 0.5) * 60,
      vy: 60 + rnd() * 140,
      size: 4 + rnd() * 6,
      rot: rnd() * Math.PI,
      vr: (rnd() - 0.5) * 6,
      color: palette[Math.floor(rnd() * palette.length)],
    }));

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const dt = 1 / 60;
      ctx.clearRect(0, 0, w, h);
      const fade = elapsed > DURATION - 500 ? Math.max(0, (DURATION - elapsed) / 500) : 1;
      for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 90 * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (elapsed < DURATION) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
}
