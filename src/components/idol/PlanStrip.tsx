"use client";

/** 이번 달 스케줄 — 주차 카드 4개 + 예상 필 (04 문서 3.3). */

import type { ActivityAvailability, PlanPreview } from "@/game/idol/engine";
import type { ActivityDef, ActivityId } from "@/game/idol/types";
import { ActivityIcon } from "./ActivityIcon";
import { Chip, Icon } from "./ui";
import { signed } from "./format";

export function PlanStrip({
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
    <section aria-label="이번 달 스케줄">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold text-[var(--ink)]">이번 달 스케줄</h2>
        <button
          type="button"
          onClick={onFillAll}
          data-testid="fill-all"
          className="-mr-1 flex min-h-[44px] items-center gap-1 px-1 text-[13px] font-bold text-[var(--accent-ink)]"
        >
          모두 같은 활동
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {plan.map((slot, index) => {
          const def = slot ? defById.get(slot) : undefined;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onPick(index)}
              data-testid={`slot-${index}`}
              className={[
                "flex h-24 flex-col items-center justify-center gap-1 rounded-[14px] px-1 text-center transition-colors duration-[120ms]",
                def
                  ? "border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  : "border border-dashed border-[var(--line)] bg-[var(--surface-2)] hover:bg-[var(--accent-soft)]",
              ].join(" ")}
            >
              <span className="text-[10px] font-bold tracking-wide text-[var(--ink-3)]">
                {index + 1}주
              </span>
              {def ? (
                <>
                  <ActivityIcon icon={def.icon} category={def.category} size={30} />
                  <span className="line-clamp-2 break-keep px-0.5 text-[10.5px] font-bold leading-[13px] text-[var(--ink)]">
                    {def.label}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink-3)]">
                    <Icon name="plus" size={16} />
                  </span>
                  <span className="text-[11px] font-bold text-[var(--ink-3)]">비어 있음</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] font-bold text-[var(--ink-3)]">예상</span>
        <Chip tone={preview.money >= 0 ? "good" : "bad"}>
          <span aria-hidden="true">💰</span>
          {signed(preview.money)}만
        </Chip>
        <Chip tone={preview.stamina >= 0 ? "good" : "bad"}>체력 {signed(preview.stamina)}</Chip>
        <Chip tone={preview.stress > 0 ? "bad" : "good"}>스트레스 {signed(preview.stress)}</Chip>
      </div>

      {preview.problems.length > 0 ? (
        <ul className="mt-2 space-y-1" data-testid="plan-problems">
          {condenseProblems(preview.problems).map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-[12px] leading-5 text-[var(--accent-ink)]">
              <span className="mt-0.5 shrink-0">
                <Icon name="warn" size={14} />
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** "1주차가 비어 있다" 같은 빈 주차 경고가 여러 줄이면 한 줄로 묶는다 (나머지 경고는 그대로) */
function condenseProblems(problems: string[]): string[] {
  const empty = problems.filter((p) => /주차가 비어 있다$/.test(p));
  if (empty.length < 2) return problems;
  const rest = problems.filter((p) => !/주차가 비어 있다$/.test(p));
  return [`비어 있는 주차 ${empty.length}개 — 카드를 눌러 활동을 고른다`, ...rest];
}
