"use client";

/**
 * 진행 — 주간 타임라인 (04 문서 3.5).
 * 공개 타이밍(visibleCount)은 play/page.tsx 의 타이머가 소유한다. 이 컴포넌트는 그만큼만 그린다.
 * (React StrictMode 의 useEffect 이중 실행으로 한 틱에 두 주가 진행되는 것을 막기 위한 설계)
 */

import { formatFans } from "@/game/idol/engine";
import { getActivity } from "@/game/idol/data/activities";
import { SKILL_IDS, SKILL_LABELS, WEEKS_PER_MONTH } from "@/game/idol/types";
import type { ActivityId, GameSettings, LogEntry, StatDelta } from "@/game/idol/types";
import { ActivityIcon } from "./ActivityIcon";
import { Chip } from "./ui";
import { signed } from "./format";

interface DeltaChip {
  key: string;
  text: string;
  up: boolean;
}

function deltaChips(d: StatDelta | undefined): DeltaChip[] {
  if (!d) return [];
  const out: DeltaChip[] = [];
  if (d.skills) {
    for (const id of SKILL_IDS) {
      const v = d.skills[id];
      if (typeof v !== "number" || Math.abs(v) < 0.05) continue;
      out.push({ key: `s-${id}`, text: `${SKILL_LABELS[id]} ${signed(v, 1)}`, up: v > 0 });
    }
  }
  if (typeof d.fans === "number" && d.fans !== 0) {
    out.push({
      key: "fans",
      text: `팬 ${d.fans > 0 ? "+" : "−"}${formatFans(Math.abs(d.fans))}`,
      up: d.fans > 0,
    });
  }
  if (typeof d.money === "number" && d.money !== 0) {
    out.push({ key: "money", text: `자금 ${signed(d.money)}만`, up: d.money > 0 });
  }
  if (typeof d.stamina === "number" && d.stamina !== 0) {
    out.push({ key: "stamina", text: `체력 ${signed(d.stamina)}`, up: d.stamina > 0 });
  }
  if (typeof d.stress === "number" && d.stress !== 0) {
    out.push({ key: "stress", text: `스트레스 ${signed(d.stress)}`, up: d.stress < 0 });
  }
  if (typeof d.bond === "number" && d.bond !== 0) {
    out.push({ key: "bond", text: `호감도 ${signed(d.bond)}`, up: d.bond > 0 });
  }
  if (typeof d.reputation === "number" && d.reputation !== 0) {
    out.push({ key: "rep", text: `평판 ${signed(d.reputation)}`, up: d.reputation > 0 });
  }
  return out;
}

/** "2주차: 보컬 레슨 — 보컬 +3.2, 체력 −15" → { head, tail } */
function splitText(text: string): { head: string; tail: string } {
  const body = text.replace(/^\d+주차:\s*/, "");
  const at = body.indexOf(" — ");
  if (at < 0) return { head: body, tail: "" };
  return { head: body.slice(0, at), tail: body.slice(at + 3) };
}

export function WeekTimeline({
  log,
  visibleCount,
  weekIndex,
  plan,
  speed,
  onToggleSpeed,
  done,
}: {
  log: LogEntry[];
  visibleCount: number;
  weekIndex: number;
  plan: Array<ActivityId | null>;
  speed: GameSettings["speed"];
  onToggleSpeed: () => void;
  done: boolean;
}) {
  const shown = log.slice(0, visibleCount);

  return (
    <section className="flex flex-1 flex-col" data-testid="week-timeline">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold text-[var(--ink)]">
          {weekIndex >= WEEKS_PER_MONTH ? "월말 정산" : `${Math.min(WEEKS_PER_MONTH, weekIndex + 1)}주차 진행 중`}
        </h2>
        <button
          type="button"
          onClick={onToggleSpeed}
          data-testid="toggle-speed"
          className="flex min-h-[44px] items-center rounded-full px-3 text-[12px] font-bold text-[var(--accent-ink)]"
        >
          {speed === "fast" ? "보통 속도" : "빠르게"}
        </button>
      </div>

      <ol className="space-y-2">
        {Array.from({ length: WEEKS_PER_MONTH }, (_, i) => {
          const week = i + 1;
          const entries = shown.filter((e) => e.week === week);
          const planned = plan[i];
          const def = planned ? getActivity(planned) : null;
          const revealed = entries.length > 0;

          if (!revealed) {
            return (
              <li
                key={week}
                className="flex items-center gap-3 rounded-[14px] border border-dashed border-[var(--line)] bg-[var(--surface-2)] p-3 opacity-60"
              >
                <span className="num w-5 shrink-0 text-[12px] font-extrabold text-[var(--ink-3)]">
                  {week}
                </span>
                {def ? <ActivityIcon icon={def.icon} category={def.category} size={32} /> : null}
                <span className="text-[13px] font-bold text-[var(--ink-3)]">
                  {def ? def.label : "계획 없음"}
                </span>
              </li>
            );
          }

          const main = entries.find((e) => e.kind === "activity") ?? entries[0];
          const extras = entries.filter((e) => e !== main);
          const { head, tail } = splitText(main.text);
          const chips = deltaChips(main.deltas);

          return (
            <li
              key={week}
              className="idol-flip rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3"
            >
              <div className="flex items-start gap-3">
                <span className="num mt-2 w-5 shrink-0 text-[12px] font-extrabold text-[var(--accent-ink)]">
                  {week}
                </span>
                {def ? <ActivityIcon icon={def.icon} category={def.category} size={32} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--ink)]">{head}</p>
                  {chips.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {chips.map((c) => (
                        <Chip key={c.key} tone={c.up ? "good" : "bad"}>
                          {c.text}
                        </Chip>
                      ))}
                    </div>
                  ) : tail ? (
                    <p className="mt-0.5 text-[12px] leading-5 text-[var(--ink-2)]">{tail}</p>
                  ) : null}
                  {extras.map((e, idx) => (
                    <p
                      key={`${e.week}-${idx}`}
                      className="mt-1.5 border-t border-[var(--line)] pt-1.5 text-[12px] leading-5 text-[var(--accent-ink)]"
                    >
                      {splitText(e.text).head}
                      {splitText(e.text).tail ? ` — ${splitText(e.text).tail}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!done ? (
        <p className="idol-pulse mt-3 text-center text-[12px] text-[var(--ink-3)]">…</p>
      ) : null}
    </section>
  );
}
