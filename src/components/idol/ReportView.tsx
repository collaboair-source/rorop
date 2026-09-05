"use client";

/** 월말 리포트 — "이달의 리포트" (04 문서 3.7). */

import { formatFans } from "@/game/idol/engine";
import { portraitSrc } from "@/game/idol/assets";
import { SKILL_IDS, SKILL_LABELS } from "@/game/idol/types";
import type { MonthReport, PortraitStage } from "@/game/idol/types";
import { Bubble } from "./Bubble";
import { Photocard, PortraitCard, cardFallback } from "./Photocard";
import { RadarChart } from "./RadarChart";
import { Silhouette } from "./Silhouette";
import { Button, Card, Chip, Delta, SectionTitle } from "./ui";
import { bubbleTime, monthLabel, moneyText, signed } from "./format";
import type { CardDef } from "./album";

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
  const show = format ?? ((v: number) => Math.round(v).toLocaleString("ko-KR"));
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-[54px] shrink-0 text-[12px] text-[var(--ink-2)]">{label}</span>
      <span className="num flex-1 text-[13px] text-[var(--ink)]">
        <span className="text-[var(--ink-3)]">{show(before)}</span>
        <span className="mx-1 text-[var(--ink-3)]">→</span>
        <span className="font-bold">{show(after)}</span>
      </span>
      <Delta value={after - before} digits={digits} />
    </div>
  );
}

export function ReportView({
  report,
  name,
  stage,
  monthCards,
  onNext,
}: {
  report: MonthReport;
  name: string;
  stage: PortraitStage;
  monthCards: CardDef[];
  onNext: () => void;
}) {
  const { before, after } = report;
  const beforeValues = SKILL_IDS.map((id) => before.skills[id]);
  const afterValues = SKILL_IDS.map((id) => after.skills[id]);
  const top = SKILL_IDS.map((id) => ({ id, diff: after.skills[id] - before.skills[id] }))
    .filter((x) => Math.abs(x.diff) >= 0.05)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3);
  const ledgerTotal = report.ledger.reduce((sum, i) => sum + i.amount, 0);
  const headline = monthCards[0];

  return (
    <section className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4" data-testid="month-report">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-[0.14em] text-[var(--ink-3)]">이달의 리포트</p>
          <h1 className="text-[24px] font-extrabold leading-8 text-[var(--ink)]">
            {monthLabel(report.month)}
          </h1>
        </div>
        {headline ? (
          <Photocard
            src={headline.src}
            frame={headline.frame}
            size="sm"
            fallback={cardFallback(headline)}
            ariaLabel={headline.label}
          />
        ) : (
          <PortraitCard
            stage={stage}
            emotion={report.emotion}
            src={portraitSrc(stage, report.emotion)}
            size="sm"
          />
        )}
      </header>

      <Card>
        <SectionTitle>능력치</SectionTitle>
        <div className="flex items-center gap-3">
          <RadarChart values={afterValues} compare={beforeValues} size={128} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {top.length === 0 ? (
              <p className="text-[12px] text-[var(--ink-2)]">이번 달은 능력치 변화가 없었다.</p>
            ) : (
              top.map((t) => (
                <Chip key={t.id} tone={t.diff > 0 ? "good" : "bad"} className="self-start">
                  {SKILL_LABELS[t.id]} {signed(t.diff, 1)}
                </Chip>
              ))
            )}
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--ink-3)]">
              점선이 지난달, 코랄이 이번 달.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle right={`팬 ${formatFans(after.fans)}`}>컨디션 · 사회</SectionTitle>
        <CompareRow label="체력" before={before.stamina} after={after.stamina} />
        <CompareRow label="스트레스" before={before.stress} after={after.stress} />
        <CompareRow label="호감도" before={before.bond} after={after.bond} />
        <CompareRow label="평판" before={before.reputation} after={after.reputation} />
        <CompareRow label="팬" before={before.fans} after={after.fans} format={formatFans} />
      </Card>

      <Card>
        <SectionTitle right={`${moneyText(after.money)} 보유`}>정산</SectionTitle>
        {report.ledger.length === 0 ? (
          <p className="text-[12px] text-[var(--ink-2)]">이번 달 고정 항목이 없다.</p>
        ) : (
          <ul className="space-y-1">
            {report.ledger.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-[var(--ink-2)]">{item.label}</span>
                <Delta value={item.amount} suffix="만" hideZero={false} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2">
          <span className="text-[13px] font-bold text-[var(--ink)]">합계</span>
          <Delta value={ledgerTotal} suffix="만" hideZero={false} />
        </div>
      </Card>

      {report.notices.length > 0 ? (
        <Card>
          <SectionTitle>공지</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {report.notices.map((n) => (
              <Chip key={n} tone="warn" className="h-auto whitespace-normal py-1 text-left leading-5">
                {n}
              </Chip>
            ))}
          </div>
        </Card>
      ) : null}

      {report.idolLine ? (
        <Bubble
          name={name}
          time={bubbleTime(report.month)}
          text={report.idolLine}
          avatar={
            <span className="block h-full w-full origin-top scale-[1.6]">
              <Silhouette stage={stage} emotion={report.emotion} size="full" badge={false} />
            </span>
          }
        />
      ) : null}

      {monthCards.length > 0 ? (
        <Card>
          <SectionTitle right={`${monthCards.length}장`}>이달의 카드</SectionTitle>
          <ul className="flex flex-wrap gap-2" data-testid="report-cards">
            {monthCards.map((card) => (
              <li key={card.id}>
                <Photocard
                  src={card.src}
                  frame={card.frame}
                  label={card.label}
                  size="md"
                  fallback={cardFallback(card)}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-auto pt-1">
        <Button full variant="primary" onClick={onNext} testId="next-month">
          다음 달로
        </Button>
      </div>
    </section>
  );
}
