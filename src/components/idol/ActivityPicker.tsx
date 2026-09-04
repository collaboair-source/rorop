"use client";

/** 활동 선택 하단 시트 — 분류 탭, 비용·체력·스트레스·효과 표기, 불가 사유 표시 */

import { useState } from "react";
import type { ActivityAvailability } from "@/game/idol/engine";
import {
  ACTIVITY_CATEGORY_LABELS,
  SKILL_LABELS,
  type ActivityCategory,
  type ActivityDef,
  type ActivityId,
  type SkillId,
} from "@/game/idol/types";
import { Button, Sheet } from "./ui";

const CATEGORY_ORDER: ActivityCategory[] = ["training", "work", "promo", "rest"];

function moneyText(money: ActivityDef["money"]): string | null {
  if (Array.isArray(money)) return `팁 +${money[0]}~${money[1]}만`;
  if (money === 0) return null;
  return money > 0 ? `+${money}만` : `−${Math.abs(money)}만`;
}

function effectTexts(def: ActivityDef): string[] {
  const out: string[] = [];
  if (def.skillGain) {
    for (const [id, mul] of Object.entries(def.skillGain)) {
      if (typeof mul !== "number") continue;
      out.push(`${SKILL_LABELS[id as SkillId]} 성장 ×${mul}`);
    }
  }
  if (typeof def.maxStaminaGain === "number") out.push(`최대 체력 +${def.maxStaminaGain}`);
  if (typeof def.bond === "number" && def.bond !== 0) out.push(`호감도 +${def.bond}`);
  if (typeof def.reputation === "number" && def.reputation !== 0) {
    out.push(`평판 +${def.reputation}`);
  }
  if (def.fansFormula) out.push("팬 증가");
  if (def.healsInjury) out.push("부상 치료");
  if (typeof def.maxPerMonth === "number") out.push(`월 ${def.maxPerMonth}회`);
  return out;
}

function StatChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 text-[11px] tabular-nums" style={{ color: tone }}>
      <span className="text-[#98A2CC]">{label}</span>
      {value}
    </span>
  );
}

export function ActivityPicker({
  list,
  title = "활동 선택",
  currentId,
  onSelect,
  onClear,
  onClose,
}: {
  list: ActivityAvailability[];
  title?: string;
  currentId?: ActivityId | null;
  onSelect: (id: ActivityId) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ActivityCategory>("training");
  const shown = list.filter((a) => a.def.category === tab);

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        currentId && onClear ? (
          <Button full small variant="ghost" onClick={onClear} testId="clear-slot">
            이 주차 비우기
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 flex gap-1.5">
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setTab(cat)}
            data-testid={`tab-${cat}`}
            className={[
              "min-h-[44px] flex-1 rounded-lg px-1 text-[12px] font-semibold transition-colors",
              tab === cat
                ? "bg-[#A78BFA] text-[#160E2E]"
                : "bg-[#1B2444] text-[#C7CCEB] hover:bg-[#222D57]",
            ].join(" ")}
          >
            {ACTIVITY_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map(({ def, available, reason }) => {
          const money = moneyText(def.money);
          const selected = currentId === def.id;
          return (
            <li key={def.id}>
              <button
                type="button"
                disabled={!available}
                onClick={() => onSelect(def.id)}
                data-testid={`activity-${def.id}`}
                className={[
                  "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                  available
                    ? selected
                      ? "border-[#A78BFA] bg-[#1F1B3D]"
                      : "border-[#2C3766] bg-[#141B33] hover:bg-[#1B2444]"
                    : "cursor-not-allowed border-[#22284A] bg-[#101736] opacity-55",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[18px]" aria-hidden="true">
                    {def.icon}
                  </span>
                  <span className="flex-1 text-[14px] font-bold text-[#EEF0FF]">{def.label}</span>
                  {selected ? (
                    <span className="text-[11px] font-bold text-[#A78BFA]">배치됨</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11.5px] leading-5 text-[#98A2CC]">{def.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {money ? (
                    <StatChip
                      label="자금"
                      value={money}
                      tone={Array.isArray(def.money) || def.money > 0 ? "#5EEAD4" : "#F87171"}
                    />
                  ) : null}
                  <StatChip
                    label="체력"
                    value={`${def.stamina > 0 ? "+" : "−"}${Math.abs(def.stamina)}`}
                    tone={def.stamina >= 0 ? "#5EEAD4" : "#F87171"}
                  />
                  <StatChip
                    label="스트레스"
                    value={`${def.stress > 0 ? "+" : "−"}${Math.abs(def.stress)}`}
                    tone={def.stress <= 0 ? "#5EEAD4" : "#F87171"}
                  />
                </div>
                {effectTexts(def).length > 0 ? (
                  <p className="mt-1 text-[11px] text-[#C7CCEB]">{effectTexts(def).join(" · ")}</p>
                ) : null}
                {!available && reason ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-[#F87171]">{reason}</p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
