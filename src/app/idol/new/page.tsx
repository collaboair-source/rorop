"use client";

/** 캐릭터 생성 (백스테이지, 04 문서 3.2) — "연습생 계약서". 이름 → 출신 5택 → 성격 4택. */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createGame, formatFans } from "@/game/idol/engine";
import { portraitSrc } from "@/game/idol/assets";
import { BACKGROUNDS } from "@/game/idol/data/backgrounds";
import { PERSONALITIES } from "@/game/idol/data/personalities";
import { saveAuto } from "@/game/idol/save";
import {
  CONCEPT_LABELS,
  SKILL_IDS,
  SKILL_LABELS,
  type BackgroundDef,
  type BackgroundId,
  type PersonalityDef,
  type PersonalityId,
} from "@/game/idol/types";
import { PortraitCard } from "@/components/idol/Photocard";
import { RadarChart } from "@/components/idol/RadarChart";
import { Button, Card, Chip, Icon } from "@/components/idol/ui";

const NAME_MAX = 8;
const DEFAULT_NAME = "하람";

function talentBadge(def: BackgroundDef): string {
  const best = SKILL_IDS.filter((id) => def.talents[id] !== 1).sort(
    (a, b) => def.talents[b] - def.talents[a],
  );
  if (best.length === 0) return "재능 보정 없음";
  return `${SKILL_LABELS[best[0]]} 재능 ×${def.talents[best[0]]}`;
}

function bestConcept(def: BackgroundDef): string {
  const sorted = (Object.keys(def.conceptAffinity) as Array<keyof typeof def.conceptAffinity>)
    .slice()
    .sort((a, b) => def.conceptAffinity[b] - def.conceptAffinity[a]);
  return `${CONCEPT_LABELS[sorted[0]]} 계열에 강하다`;
}

function mulText(label: string, mul: number, invert = false): string | null {
  if (mul === 1) return null;
  const up = invert ? mul < 1 : mul > 1;
  const pct = Math.round(Math.abs(mul - 1) * 100);
  return `${label} ${up ? "+" : "−"}${pct}%`;
}

function personalityEffects(def: PersonalityDef): string {
  const out: string[] = [];
  for (const t of [
    mulText("훈련 효과", def.trainingMul),
    mulText("스트레스 증가", def.stressMul),
    mulText("휴식 회복", def.restMul),
    mulText("팬 증가", def.fansMul),
    mulText("호감도 증가", def.bondMul),
    mulText("스캔들 확률", def.scandalMul),
  ]) {
    if (t) out.push(t);
  }
  for (const [concept, bonus] of Object.entries(def.conceptBonus)) {
    if (typeof bonus !== "number") continue;
    out.push(`${CONCEPT_LABELS[concept as keyof typeof CONCEPT_LABELS]} 적성 +${bonus}`);
  }
  return out.join(" · ");
}

export default function IdolNewGamePage() {
  const router = useRouter();
  const [name, setName] = useState(DEFAULT_NAME);
  const [background, setBackground] = useState<BackgroundId | null>(null);
  const [personality, setPersonality] = useState<PersonalityId | null>(null);

  const trimmed = name.trim();
  const nameValid = trimmed.length >= 1 && trimmed.length <= NAME_MAX;
  const ready = nameValid && background !== null && personality !== null;

  const preview = useMemo(
    () =>
      createGame({
        name: nameValid ? trimmed : DEFAULT_NAME,
        background: background ?? "street_cast",
        personality: personality ?? "diligent",
        seed: 1,
      }),
    [background, personality, nameValid, trimmed],
  );

  const start = useCallback(() => {
    if (!nameValid || !background || !personality) return;
    const state = createGame({ name: trimmed, background, personality });
    saveAuto(state);
    router.push("/idol/play");
  }, [background, nameValid, personality, router, trimmed]);

  const personalityDef = personality ? PERSONALITIES.find((p) => p.id === personality) : null;

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-[132px] pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/idol")}
          aria-label="타이틀로"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
        >
          <Icon name="back" size={20} />
        </button>
        <p className="text-[12px] font-bold tracking-[0.14em] text-[var(--ink-3)]">연습생 등록</p>
        <span className="h-11 w-11" aria-hidden="true" />
      </div>

      {/* 1. 계약서 */}
      <Card>
        <p className="text-[12px] font-bold tracking-[0.1em] text-[var(--accent-ink)]">
          루미너스 엔터테인먼트
        </p>
        <h1 className="mt-0.5 text-[20px] font-extrabold text-[var(--ink)]">연습생 계약서</h1>
        <p className="mt-2 text-[12px] leading-5 text-[var(--ink-2)]">
          아래 서명란에 이름을 적는다. 앞으로 3년, 이 이름을 부르며 살게 된다.
        </p>

        <label className="mt-4 block">
          <span className="text-[11px] font-bold tracking-[0.14em] text-[var(--ink-3)]">서명</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            maxLength={NAME_MAX}
            placeholder={DEFAULT_NAME}
            aria-label="아이돌 이름"
            data-testid="name-input"
            className="mt-1 min-h-[52px] w-full border-b-2 border-[var(--line)] bg-transparent pb-1 text-[24px] font-extrabold text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--accent)]"
          />
        </label>
        <p className={`mt-1 text-[11px] ${nameValid ? "text-[var(--ink-3)]" : "text-[var(--bad)]"}`}>
          {nameValid ? `${trimmed.length}/${NAME_MAX}자` : `이름은 1~${NAME_MAX}자로 정해 주세요.`}
        </p>
      </Card>

      {/* 2. 출신 */}
      {nameValid ? (
        <section className="idol-fade-up">
          <h2 className="mb-2 text-[15px] font-extrabold text-[var(--ink)]">
            어디에서 왔나
            <span className="ml-1.5 text-[12px] font-bold text-[var(--ink-3)]">출신 5택</span>
          </h2>
          <ul className="idol-hscroll idol-no-scrollbar -mx-4 px-4 pb-1">
            {BACKGROUNDS.map((def) => {
              const on = background === def.id;
              return (
                <li key={def.id} className="w-[220px]">
                  <button
                    type="button"
                    onClick={() => setBackground(def.id)}
                    data-testid={`bg-${def.id}`}
                    className={[
                      "flex h-full w-full flex-col rounded-[20px] border-2 p-3 text-left transition-colors duration-[120ms]",
                      on
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] bg-[var(--surface)]",
                    ].join(" ")}
                  >
                    <span className="text-[16px] font-extrabold text-[var(--ink)]">{def.label}</span>
                    <span className="mt-1 block text-[12px] leading-5 text-[var(--ink-2)]">
                      {def.description}
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <RadarChart
                        values={SKILL_IDS.map((id) => def.skills[id])}
                        size={80}
                        showLabels={false}
                      />
                      <span className="num flex-1 text-[11px] leading-5 text-[var(--ink-2)]">
                        팬 {formatFans(def.startFans)}
                        <br />
                        자금 {def.startMoney}만
                        <br />
                        최대 체력 {def.maxStamina}
                      </span>
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      <Chip tone="accent">{talentBadge(def)}</Chip>
                      <Chip>{bestConcept(def)}</Chip>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* 3. 성격 */}
      {background ? (
        <section className="idol-fade-up">
          <h2 className="mb-2 text-[15px] font-extrabold text-[var(--ink)]">
            어떤 사람인가
            <span className="ml-1.5 text-[12px] font-bold text-[var(--ink-3)]">성격 4택</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {PERSONALITIES.map((def) => {
              const on = personality === def.id;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setPersonality(def.id)}
                  data-testid={`pers-${def.id}`}
                  className={[
                    "min-h-[44px] rounded-full border-2 px-4 text-[14px] font-bold transition-colors duration-[120ms]",
                    on
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
                  ].join(" ")}
                >
                  {def.label}
                </button>
              );
            })}
          </div>
          {personalityDef ? (
            <p className="mt-2 text-[12px] leading-6 text-[var(--ink-2)]">
              {personalityDef.description}
              <br />
              <span className="text-[var(--accent-ink)]">{personalityEffects(personalityDef)}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 하단 고정 — 미리보기 포토카드 + 계약 체결 */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <PortraitCard
            stage="trainee"
            emotion="neutral"
            src={portraitSrc("trainee", "neutral")}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold text-[var(--ink)]">
              {nameValid ? trimmed : DEFAULT_NAME}
            </p>
            <p className="num truncate text-[12px] text-[var(--ink-2)]">
              자금 {preview.economy.money}만 · 팬 {formatFans(preview.idol.social.fans)}
            </p>
          </div>
          <Button variant="primary" disabled={!ready} onClick={start} testId="start-game">
            계약 체결
          </Button>
        </div>
      </div>
    </main>
  );
}
