"use client";

/** 스탯 상세 바텀시트 — 글래스 카드를 탭하면 열린다 (04 문서 3.3). 바·숫자·재능 힌트. */

import { formatFans } from "@/game/idol/engine";
import { SKILL_IDS, SKILL_LABELS } from "@/game/idol/types";
import type { Idol, SkillId } from "@/game/idol/types";
import { Sheet } from "./ui";

function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <span
        className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

function Row({
  label,
  value,
  max = 100,
  hint,
  suffix = "",
  digits = 0,
}: {
  label: string;
  value: number;
  max?: number;
  hint?: string;
  suffix?: string;
  digits?: number;
}) {
  return (
    <li className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold text-[var(--ink)]">{label}</span>
        <span className="flex items-baseline gap-1.5">
          {hint ? <span className="text-[11px] text-[var(--accent-ink)]">{hint}</span> : null}
          <span className="num text-[14px] font-extrabold text-[var(--ink)]">
            {value.toFixed(digits)}
            {suffix}
          </span>
        </span>
      </div>
      <div className="mt-1">
        <Bar value={value} max={max} />
      </div>
    </li>
  );
}

export function StatSheet({ idol, onClose }: { idol: Idol; onClose: () => void }) {
  const c = idol.condition;
  return (
    <Sheet title="능력치와 컨디션" subtitle={idol.name} onClose={onClose}>
      <ul className="mb-3" data-testid="stat-sheet">
        {SKILL_IDS.map((id: SkillId) => {
          const talent = idol.talents[id];
          return (
            <Row
              key={id}
              label={SKILL_LABELS[id]}
              value={idol.skills[id]}
              digits={1}
              hint={talent !== 1 ? `재능 ×${talent}` : undefined}
            />
          );
        })}
      </ul>

      <div className="border-t border-[var(--line)] pt-2">
        <ul>
          <Row label="체력" value={c.stamina} max={c.maxStamina} suffix={`/${Math.round(c.maxStamina)}`} />
          <Row label="스트레스" value={c.stress} />
          <Row label="호감도" value={idol.social.bond} />
          <Row label="평판" value={idol.social.reputation} />
        </ul>
        <p className="mt-2 text-[12px] text-[var(--ink-2)]">팬 {formatFans(idol.social.fans)}</p>
        {c.injured ? (
          <p className="mt-2 rounded-[14px] bg-[var(--surface-2)] px-3 py-2 text-[12px] font-bold text-[var(--bad)]">
            부상 중 — 훈련 효과 ×0.5, 체력 소모 ×1.3
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
