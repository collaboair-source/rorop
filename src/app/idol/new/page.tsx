"use client";

/** 캐릭터 생성 — 이름 · 출신 5택 · 성격 4택 + 초기 스탯 미리보기 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createGame, formatFans } from "@/game/idol/engine";
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
  type SkillId,
} from "@/game/idol/types";
import { Portrait } from "@/components/idol/Portrait";
import { StatPanel } from "@/components/idol/StatPanel";
import { Button, Card, SectionTitle } from "@/components/idol/ui";

const NAME_MAX = 8;
const DEFAULT_NAME = "하람";

function talentText(def: BackgroundDef): string {
  const parts = SKILL_IDS.filter((id) => def.talents[id] !== 1).map(
    (id) => `${SKILL_LABELS[id]} ×${def.talents[id]}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "재능 보정 없음";
}

function bestConcepts(def: BackgroundDef): string {
  const sorted = (Object.keys(def.conceptAffinity) as Array<keyof typeof def.conceptAffinity>)
    .slice()
    .sort((a, b) => def.conceptAffinity[b] - def.conceptAffinity[a]);
  return `${CONCEPT_LABELS[sorted[0]]} 계열에 강한 편`;
}

function mulText(label: string, mul: number, invert = false): string | null {
  if (mul === 1) return null;
  const up = invert ? mul < 1 : mul > 1;
  const pct = Math.round(Math.abs(mul - 1) * 100);
  return `${label} ${up ? "+" : "−"}${pct}%`;
}

function personalityText(def: PersonalityDef): string[] {
  const out: string[] = [];
  const training = mulText("훈련 효과", def.trainingMul);
  const stress = mulText("스트레스 증가", def.stressMul);
  const rest = mulText("휴식 회복", def.restMul);
  const fans = mulText("팬 증가", def.fansMul);
  const bond = mulText("호감도 증가", def.bondMul);
  const scandal = mulText("스캔들 확률", def.scandalMul);
  for (const t of [training, stress, rest, fans, bond, scandal]) if (t) out.push(t);
  for (const [concept, bonus] of Object.entries(def.conceptBonus)) {
    if (typeof bonus !== "number") continue;
    out.push(`${CONCEPT_LABELS[concept as keyof typeof CONCEPT_LABELS]} 적성 +${bonus}`);
  }
  return out;
}

function SkillPreviewRow({ def }: { def: BackgroundDef }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
      {SKILL_IDS.map((id: SkillId) => (
        <span key={id} className="text-[11px] text-[#C7CCEB]">
          {SKILL_LABELS[id]}{" "}
          <span className="font-bold tabular-nums text-[#EEF0FF]">{def.skills[id]}</span>
        </span>
      ))}
    </div>
  );
}

export default function IdolNewGamePage() {
  const router = useRouter();
  const [name, setName] = useState(DEFAULT_NAME);
  const [background, setBackground] = useState<BackgroundId>("street_cast");
  const [personality, setPersonality] = useState<PersonalityId>("diligent");

  const trimmed = name.trim();
  const nameValid = trimmed.length >= 1 && trimmed.length <= NAME_MAX;

  const preview = useMemo(
    () =>
      createGame({
        name: nameValid ? trimmed : DEFAULT_NAME,
        background,
        personality,
        seed: 1,
      }),
    [background, personality, nameValid, trimmed],
  );

  const start = useCallback(() => {
    if (!nameValid) return;
    const state = createGame({ name: trimmed, background, personality });
    saveAuto(state);
    router.push("/idol/play");
  }, [background, nameValid, personality, router, trimmed]);

  return (
    <main className="flex flex-1 flex-col gap-3 px-3 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[19px] font-black">연습생 등록</h1>
        <Button small variant="ghost" onClick={() => router.push("/idol")}>
          타이틀로
        </Button>
      </div>

      <Card>
        <SectionTitle right={`${trimmed.length}/${NAME_MAX}`}>이름</SectionTitle>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
          maxLength={NAME_MAX}
          placeholder={DEFAULT_NAME}
          aria-label="아이돌 이름"
          data-testid="name-input"
          className="min-h-[44px] w-full rounded-xl border border-[#2C3766] bg-[#0E1533] px-3 text-[15px] text-[#EEF0FF] outline-none placeholder:text-[#4E5680] focus:border-[#A78BFA]"
        />
        {!nameValid ? (
          <p className="mt-1 text-[11px] text-[#F87171]">이름은 1~{NAME_MAX}자로 정해 주세요.</p>
        ) : (
          <p className="mt-1 text-[11px] text-[#98A2CC]">성을 빼고 부르는 이름으로 지어도 좋다.</p>
        )}
      </Card>

      <div>
        <SectionTitle>출신</SectionTitle>
        <ul className="space-y-2">
          {BACKGROUNDS.map((def) => (
            <li key={def.id}>
              <button
                type="button"
                onClick={() => setBackground(def.id)}
                data-testid={`bg-${def.id}`}
                className={[
                  "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                  background === def.id
                    ? "border-[#A78BFA] bg-[#1F1B3D]"
                    : "border-[#2C3766] bg-[#141B33] hover:bg-[#1B2444]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold">{def.label}</span>
                  <span className="text-[11px] text-[#5EEAD4]">{talentText(def)}</span>
                </div>
                <p className="mt-1 text-[11.5px] leading-5 text-[#98A2CC]">{def.description}</p>
                <SkillPreviewRow def={def} />
                <p className="mt-1.5 text-[11px] text-[#C7CCEB]">
                  시작 팬 {formatFans(def.startFans)} · 자금 {def.startMoney}만 · 최대 체력{" "}
                  {def.maxStamina} · 스트레스 {def.startStress} · 평판 {def.startReputation} ·{" "}
                  {bestConcepts(def)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionTitle>성격</SectionTitle>
        <ul className="grid grid-cols-2 gap-2">
          {PERSONALITIES.map((def) => (
            <li key={def.id}>
              <button
                type="button"
                onClick={() => setPersonality(def.id)}
                data-testid={`pers-${def.id}`}
                className={[
                  "h-full w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                  personality === def.id
                    ? "border-[#5EEAD4] bg-[#0F2B2A]"
                    : "border-[#2C3766] bg-[#141B33] hover:bg-[#1B2444]",
                ].join(" ")}
              >
                <span className="text-[13.5px] font-bold">{def.label}</span>
                <p className="mt-1 text-[11px] leading-5 text-[#98A2CC]">{def.description}</p>
                <ul className="mt-1.5 space-y-0.5">
                  {personalityText(def).map((t) => (
                    <li key={t} className="text-[10.5px] leading-4 text-[#C7CCEB]">
                      · {t}
                    </li>
                  ))}
                </ul>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Card>
        <SectionTitle>초기 스탯 미리보기</SectionTitle>
        <div className="flex gap-3">
          <Portrait stage="trainee" emotion="neutral" name={preview.idol.name} size="md" />
          <StatPanel idol={preview.idol} />
        </div>
        <p className="mt-2 text-[11.5px] text-[#98A2CC]">
          자금 {preview.economy.money}만 · 팬 {formatFans(preview.idol.social.fans)} · 트레이너 1등급
        </p>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-[#242E52] bg-[#0B1020]/95 px-3 py-3 backdrop-blur">
        <Button full variant="primary" disabled={!nameValid} onClick={start} testId="start-game">
          시작
        </Button>
      </div>
    </main>
  );
}
