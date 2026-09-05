"use client";

/** 활동 선택 바텀시트 (04 문서 3.4) — 분류 탭 4개, 행마다 효과 필, 불가하면 회색 + 사유. */

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
import { ActivityIcon } from "./ActivityIcon";
import { Button, Chip, Sheet } from "./ui";

const CATEGORY_ORDER: ActivityCategory[] = ["training", "work", "promo", "rest"];

function moneyText(money: ActivityDef["money"]): string | null {
  if (Array.isArray(money)) return `팁 +${money[0]}~${money[1]}만`;
  if (money === 0) return null;
  return money > 0 ? `+${money}만` : `−${Math.abs(money)}만`;
}

function skillChips(def: ActivityDef): string[] {
  const out: string[] = [];
  if (def.skillGain) {
    for (const [id, mul] of Object.entries(def.skillGain)) {
      if (typeof mul !== "number") continue;
      out.push(`${SKILL_LABELS[id as SkillId]} ↑`);
    }
  }
  if (typeof def.maxStaminaGain === "number") out.push("최대 체력 ↑");
  if (def.fansFormula) out.push("팬 ↑");
  if (typeof def.bond === "number" && def.bond !== 0) out.push("호감도 ↑");
  if (typeof def.reputation === "number" && def.reputation !== 0) out.push("평판 ↑");
  if (def.healsInjury) out.push("부상 치료");
  return out;
}

export function ActivitySheet({
  list,
  title,
  subtitle,
  currentId,
  applyAll,
  onToggleApplyAll,
  onSelect,
  onClear,
  onClose,
}: {
  list: ActivityAvailability[];
  title: string;
  subtitle?: string;
  currentId?: ActivityId | null;
  applyAll: boolean;
  onToggleApplyAll: () => void;
  onSelect: (id: ActivityId) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ActivityCategory>("training");
  const shown = list.filter((a) => a.def.category === tab);

  return (
    <Sheet
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {onClear ? (
            <Button small variant="secondary" className="flex-1" onClick={onClear} testId="clear-slot">
              이 주차 비우기
            </Button>
          ) : null}
          <Button
            small
            variant={applyAll ? "primary" : "secondary"}
            className="flex-1"
            onClick={onToggleApplyAll}
            testId="apply-all-toggle"
          >
            {applyAll ? "4주 모두 적용 중" : "4주 모두 이 활동으로"}
          </Button>
        </div>
      }
    >
      <div
        className="sticky top-0 z-10 -mx-4 mb-3 flex gap-1 border-b border-[var(--line)] bg-[var(--bg)] px-4"
        role="tablist"
      >
        {CATEGORY_ORDER.map((cat) => {
          const on = tab === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(cat)}
              data-testid={`tab-${cat}`}
              className={[
                "min-h-[44px] flex-1 border-b-2 px-1 text-[13px] font-bold transition-colors duration-[120ms]",
                on
                  ? "border-[var(--accent)] text-[var(--accent-ink)]"
                  : "border-transparent text-[var(--ink-3)]",
              ].join(" ")}
            >
              {ACTIVITY_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
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
                  "w-full rounded-[14px] border p-3 text-left transition-colors duration-[120ms]",
                  available
                    ? selected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                    : "cursor-not-allowed border-[var(--line)] bg-[var(--surface-2)] opacity-70",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <ActivityIcon icon={def.icon} category={def.category} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--ink)]">
                      {def.label}
                      {selected ? (
                        <span className="text-[11px] font-bold text-[var(--accent-ink)]">배치됨</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-5 text-[var(--ink-2)]">{def.description}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {money ? (
                        <Chip tone={Array.isArray(def.money) || def.money > 0 ? "good" : "bad"}>
                          💰 {money}
                        </Chip>
                      ) : null}
                      <Chip tone={def.stamina >= 0 ? "good" : "bad"}>
                        체력 {def.stamina > 0 ? "+" : "−"}
                        {Math.abs(def.stamina)}
                      </Chip>
                      {def.stress !== 0 ? (
                        <Chip tone={def.stress <= 0 ? "good" : "bad"}>
                          스트레스 {def.stress > 0 ? "+" : "−"}
                          {Math.abs(def.stress)}
                        </Chip>
                      ) : null}
                      {skillChips(def).map((t) => (
                        <Chip key={t} tone="accent">
                          {t}
                        </Chip>
                      ))}
                      {typeof def.maxPerMonth === "number" ? (
                        <Chip>월 {def.maxPerMonth}회</Chip>
                      ) : null}
                    </div>
                    {!available && reason ? (
                      <p className="mt-1.5 text-[12px] font-bold text-[var(--ink-3)]">{reason}</p>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
