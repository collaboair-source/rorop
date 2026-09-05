"use client";

/** 6각 레이더 (04 문서 3.3 / 3.7). 채움 코랄 24% + 선 코랄, 격자 2단(50·100). */

import { SKILL_IDS, SKILL_LABELS } from "@/game/idol/types";
import type { Skills } from "@/game/idol/types";

const AXES = 6;
const CENTER = 50;
const RADIUS = 33;

export const RADAR_LABELS: string[] = SKILL_IDS.map((id) => SKILL_LABELS[id]);

export function skillsToValues(skills: Skills): number[] {
  return SKILL_IDS.map((id) => skills[id]);
}

function point(index: number, ratio: number): [number, number] {
  const angle = (Math.PI * 2 * index) / AXES - Math.PI / 2;
  return [CENTER + Math.cos(angle) * RADIUS * ratio, CENTER + Math.sin(angle) * RADIUS * ratio];
}

function polygon(values: number[], max: number): string {
  return values
    .map((v, i) => {
      const [x, y] = point(i, Math.max(0, Math.min(1, v / max)));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function RadarChart({
  values,
  compare,
  size = 110,
  labels = RADAR_LABELS,
  max = 100,
  showLabels = true,
  className = "",
}: {
  values: number[];
  compare?: number[];
  size?: number;
  labels?: string[];
  max?: number;
  showLabels?: boolean;
  className?: string;
}) {
  const box = showLabels ? 100 : 74;
  const offset = showLabels ? 0 : 13;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${offset} ${offset} ${box} ${box}`}
      className={className}
      role="img"
      aria-label={labels.map((l, i) => `${l} ${Math.round(values[i] ?? 0)}`).join(", ")}
    >
      {/* 격자 2단 */}
      {[0.5, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={polygon(new Array(AXES).fill(max * ratio), max)}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
      {/* 축 */}
      {Array.from({ length: AXES }, (_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="var(--line)"
            strokeWidth={1}
          />
        );
      })}

      {/* 비교(전) — 점선 */}
      {compare ? (
        <polygon
          points={polygon(compare, max)}
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth={1.4}
          strokeDasharray="3 2.5"
        />
      ) : null}

      {/* 현재(후) */}
      <polygon
        points={polygon(values, max)}
        fill="var(--accent)"
        fillOpacity={0.24}
        stroke="var(--accent)"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />

      {showLabels
        ? labels.map((label, i) => {
            const [x, y] = point(i, 1.34);
            return (
              <text
                key={label}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7.5}
                fontWeight={700}
                fill="var(--ink-3)"
              >
                {label}
              </text>
            );
          })
        : null}
    </svg>
  );
}
