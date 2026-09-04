"use client";

/** 월말 리포트 — 전/후 스탯 비교, 수입·지출 내역, 공지, 하람의 한마디 */

import { formatFans } from "@/game/idol/engine";
import { SKILL_IDS, SKILL_LABELS } from "@/game/idol/types";
import type { MonthReport as MonthReportData, PortraitStage } from "@/game/idol/types";
import { DialogueBox } from "./DialogueBox";
import { Portrait } from "./Portrait";
import { monthLabel } from "./TopBar";
import { Button, Card, Delta, SectionTitle } from "./ui";

function CompareRow({
  label,
  before,
  after,
  digits = 0,
  format,
}: {
  label: string;
  before: number;
  after: number;
  digits?: number;
  format?: (v: number) => string;
}) {
  const diff = after - before;
  const show = format ?? ((v: number) => Math.round(v).toLocaleString("ko-KR"));
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-[52px] shrink-0 text-[11px] text-[#98A2CC]">{label}</span>
      <span className="flex-1 text-[12px] tabular-nums text-[#EEF0FF]">
        <span className="text-[#6E78A8]">{show(before)}</span>
        <span className="mx-1 text-[#6E78A8]">→</span>
        <span className="font-semibold">{show(after)}</span>
      </span>
      <Delta value={diff} digits={digits} />
    </div>
  );
}

export function MonthReport({
  report,
  name,
  stage,
  onNext,
}: {
  report: MonthReportData;
  name: string;
  stage: PortraitStage;
  onNext: () => void;
}) {
  const { before, after } = report;
  const changedSkills = SKILL_IDS.filter((id) => Math.abs(after.skills[id] - before.skills[id]) >= 0.05);

  return (
    <section className="flex flex-1 flex-col gap-3" data-testid="month-report">
      <div>
        <h1 className="text-[18px] font-black">{monthLabel(report.month)} 결산</h1>
        <p className="text-[12px] text-[#98A2CC]">한 달이 지났다. 숫자로 남은 것들.</p>
      </div>

      <Card>
        <SectionTitle>능력치</SectionTitle>
        {changedSkills.length === 0 ? (
          <p className="text-[12px] text-[#98A2CC]">이번 달은 능력치 변화가 없었다.</p>
        ) : (
          changedSkills.map((id) => (
            <CompareRow
              key={id}
              label={SKILL_LABELS[id]}
              before={before.skills[id]}
              after={after.skills[id]}
              digits={1}
              format={(v) => v.toFixed(1)}
            />
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>컨디션과 사회</SectionTitle>
        <CompareRow label="체력" before={before.stamina} after={after.stamina} />
        <CompareRow label="스트레스" before={before.stress} after={after.stress} />
        <CompareRow label="팬" before={before.fans} after={after.fans} format={formatFans} />
        <CompareRow label="호감도" before={before.bond} after={after.bond} />
        <CompareRow label="평판" before={before.reputation} after={after.reputation} />
      </Card>

      <Card>
        <SectionTitle right={`${after.money.toLocaleString("ko-KR")}만 보유`}>수입 · 지출</SectionTitle>
        <CompareRow label="자금" before={before.money} after={after.money} format={(v) => `${Math.round(v).toLocaleString("ko-KR")}만`} />
        {report.ledger.length > 0 ? (
          <ul className="mt-1 space-y-0.5 border-t border-[#242E52] pt-1.5">
            {report.ledger.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center justify-between">
                <span className="text-[11.5px] text-[#C7CCEB]">{item.label}</span>
                <Delta value={item.amount} suffix="만" hideZero={false} />
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {report.notices.length > 0 ? (
        <Card>
          <SectionTitle>공지</SectionTitle>
          <ul className="space-y-1">
            {report.notices.map((n) => (
              <li key={n} className="text-[12px] leading-6 text-[#FCD34D]">
                · {n}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex items-end gap-2">
        <Portrait stage={stage} emotion={report.emotion} name={name} size="sm" />
        <DialogueBox className="flex-1" speaker={name} text={report.idolLine} />
      </div>

      <div className="mt-auto pt-1">
        <Button full variant="primary" onClick={onNext} testId="next-month">
          다음 달로
        </Button>
      </div>
    </section>
  );
}
