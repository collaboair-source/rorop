"use client";

/** 능력치 6종 바 + 체력/스트레스/호감도/평판 (스트레스 ≥ 70 붉은색, 체력 < 30 주황) */

import { SKILL_IDS, SKILL_LABELS } from "@/game/idol/types";
import type { Idol, SkillId } from "@/game/idol/types";
import { Bar, COLOR } from "./ui";

const SKILL_COLORS: Record<SkillId, string> = {
  vocal: "#A78BFA",
  dance: "#5EEAD4",
  rap: "#F0ABFC",
  visual: "#93C5FD",
  variety: "#FCD34D",
  acting: "#86EFAC",
};

export const STRESS_WARN_LINE = 70;
export const STAMINA_WARN_LINE = 30;

function ConditionRow({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[46px] shrink-0 text-[11px] text-[#98A2CC]">{label}</span>
      <div className="flex-1">
        <Bar value={value} max={max} color={color} height={6} />
      </div>
      <span className="w-[58px] shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color }}>
        {Math.round(value)}
        {suffix ?? ""}
      </span>
    </div>
  );
}

export function StatPanel({
  idol,
  compact = false,
  className = "",
}: {
  idol: Idol;
  compact?: boolean;
  className?: string;
}) {
  const c = idol.condition;
  const staminaColor = c.stamina < STAMINA_WARN_LINE ? COLOR.orange : COLOR.mint;
  const stressColor = c.stress >= STRESS_WARN_LINE ? COLOR.warn : COLOR.lavender;

  return (
    <div className={`flex-1 ${className}`}>
      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        {SKILL_IDS.map((id) => (
          <div key={id} className="flex items-center gap-2">
            <span className="w-[42px] shrink-0 text-[11px] text-[#C7CCEB]">{SKILL_LABELS[id]}</span>
            <div className="flex-1">
              <Bar value={idol.skills[id]} max={100} color={SKILL_COLORS[id]} height={7} />
            </div>
            <span className="w-[26px] shrink-0 text-right text-[11px] font-semibold tabular-nums text-[#EEF0FF]">
              {Math.round(idol.skills[id])}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-1 border-t border-[#242E52] pt-2">
        <ConditionRow
          label="체력"
          value={c.stamina}
          max={c.maxStamina}
          color={staminaColor}
          suffix={`/${Math.round(c.maxStamina)}`}
        />
        <ConditionRow label="스트레스" value={c.stress} max={100} color={stressColor} />
        {compact ? null : (
          <>
            <ConditionRow label="호감도" value={idol.social.bond} max={100} color="#F9A8D4" />
            <ConditionRow label="평판" value={idol.social.reputation} max={100} color="#93C5FD" />
          </>
        )}
      </div>

      {c.injured ? (
        <p className="mt-2 rounded-lg bg-[#3A1C24] px-2 py-1 text-[11px] font-semibold text-[#F87171]">
          부상 중 — 훈련 효과 ×0.5, 체력 소모 ×1.3
        </p>
      ) : null}
    </div>
  );
}
