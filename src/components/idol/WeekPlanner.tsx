"use client";

/** 이번 달 계획 — 4개 주간 슬롯 + 예상 지출·체력·스트레스 + "모두 같은 활동" */

import type { ActivityAvailability, PlanPreview } from "@/game/idol/engine";
import type { ActivityDef, ActivityId } from "@/game/idol/types";
import { Button, COLOR } from "./ui";

function PreviewValue({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const positive = value > 0;
  const color = value === 0 ? COLOR.muted : positive ? COLOR.mint : COLOR.warn;
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[11px] text-[#98A2CC]">{label}</span>
      <span className="text-[12px] font-bold tabular-nums" style={{ color }}>
        {value > 0 ? "+" : value < 0 ? "−" : ""}
        {Math.abs(Math.round(value)).toLocaleString("ko-KR")}
        {suffix}
      </span>
    </span>
  );
}

export function WeekPlanner({
  plan,
  activities,
  preview,
  onPick,
  onFillAll,
}: {
  plan: Array<ActivityId | null>;
  activities: ActivityAvailability[];
  preview: PlanPreview;
  onPick: (slot: number) => void;
  onFillAll: () => void;
}) {
  const defById = new Map<ActivityId, ActivityDef>(activities.map((a) => [a.def.id, a.def]));

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {plan.map((slot, index) => {
          const def = slot ? defById.get(slot) : undefined;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onPick(index)}
              data-testid={`slot-${index}`}
              className={[
                "flex min-h-[62px] w-full flex-col justify-center gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                def
                  ? "border-[#3B2F6B] bg-[#1B2444] hover:bg-[#222D57]"
                  : "border-dashed border-[#2C3766] bg-[#111832] hover:bg-[#161E3A]",
              ].join(" ")}
            >
              <span className="text-[10px] font-bold tracking-wide text-[#98A2CC]">
                {index + 1}주차
              </span>
              {def ? (
                <span className="flex items-center gap-1 text-[13px] font-semibold text-[#EEF0FF]">
                  <span aria-hidden="true">{def.icon}</span>
                  <span className="truncate">{def.label}</span>
                </span>
              ) : (
                <span className="text-[13px] text-[#6E78A8]">비어 있음 — 탭해서 배치</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[#111832] px-2.5 py-2">
        <PreviewValue label="예상 자금" value={preview.money} suffix="만" />
        <PreviewValue label="체력" value={preview.stamina} suffix="" />
        <PreviewValue label="스트레스" value={preview.stress} suffix="" />
      </div>

      {preview.problems.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {preview.problems.map((p) => (
            <li key={p} className="text-[11px] text-[#F87171]">
              · {p}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2">
        <Button small variant="ghost" onClick={onFillAll} testId="fill-all">
          모두 같은 활동으로 채우기
        </Button>
      </div>
    </div>
  );
}
