// 주간 크롤링 후 신규 매칭 공고를 웹훅(Slack / Discord / 임의 JSON 수신처)으로 알린다.
// NOTIFY_WEBHOOK_URL 이 없으면 아무것도 하지 않는다.

import type { MatchResult, ProgramAnalysis, SupportProgram } from "./types";
import { SOURCE_LABEL } from "./types";
import type { FetchLike } from "./http";

export interface DigestItem {
  program: SupportProgram;
  match: MatchResult;
  analysis?: ProgramAnalysis | null;
}

export function buildDigestText(items: DigestItem[], opts: { appUrl?: string; totalNew: number; when?: string } ): string {
  const when = opts.when || new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`📌 [${when}] 지원사업 주간 크롤링 — 신규 ${opts.totalNew}건, 매칭 상위 ${items.length}건`);
  for (const it of items) {
    const p = it.program;
    const end = p.apply_end ? `~${p.apply_end}` : "마감 미상";
    const ai = it.analysis ? ` · AI ${it.analysis.fit_score}점(${it.analysis.recommended_action})` : "";
    const link = opts.appUrl ? `${opts.appUrl.replace(/\/$/, "")}/support/${encodeURIComponent(p.id)}` : p.url;
    lines.push(`• [${it.match.score}점] ${p.title} (${SOURCE_LABEL[p.source]}, ${end})${ai}\n  ${link}`);
  }
  if (items.length === 0) lines.push("• 프로필과 맞는 신규 공고가 없습니다.");
  return lines.join("\n");
}

export async function sendWebhook(text: string, opts: { url?: string; fetchImpl?: FetchLike } = {}): Promise<boolean> {
  const url = opts.url ?? process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return false;
  const fetchImpl = opts.fetchImpl || fetch;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Slack 은 text, Discord 는 content 를 읽는다. 둘 다 보낸다.
    body: JSON.stringify({ text, content: text.slice(0, 1900) }),
  });
  if (!res.ok) throw new Error(`웹훅 전송 실패: HTTP ${res.status}`);
  return true;
}
