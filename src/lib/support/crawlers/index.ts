// 전체 크롤링 파이프라인:
//   1) 소스별 크롤링 (API → HTML 폴백)  2) 저장소 병합(신규/변경 감지)
//   3) 신규 공고 규칙 점수 계산         4) 상위 N건 AI 분석 (키 있을 때)
//   5) 웹훅 요약 알림                    6) 크롤링 로그 저장

import { v4 as uuidv4 } from "uuid";
import type { CrawlLog, CrawlSourceResult, CrawlTrigger, ProgramSource, SupportProgram } from "../types";
import { addCrawlLog, getAnalysis, getProfile, getProgram, saveAnalysis, upsertPrograms } from "../store";
import { scoreProgram } from "../matching";
import { analyzeProgram, isAiConfigured } from "../ai";
import { buildDigestText, sendWebhook, type DigestItem } from "../notify";
import { crawlBizinfo, type CrawlOutput } from "./bizinfo";
import { crawlKstartup } from "./kstartup";
import type { FetchLike } from "../http";
import { toISODate } from "../text";

export interface RunCrawlOptions {
  trigger: CrawlTrigger;
  sources?: ProgramSource[];
  fetchImpl?: FetchLike;
  /** 신규 공고 중 규칙 점수 상위 N건을 자동 AI 분석 (기본: env SUPPORT_AI_AUTO_ANALYZE_TOP_N 또는 0) */
  analyzeTopN?: number;
  analyzeMinScore?: number;
  notify?: boolean;
  today?: string;
  log?: (msg: string) => void;
}

export interface RunCrawlResult extends CrawlLog {
  warnings: string[];
  digest_items: DigestItem[];
}

const CRAWLERS: Record<Exclude<ProgramSource, "manual">, (fetchImpl?: FetchLike) => Promise<CrawlOutput>> = {
  bizinfo: (fetchImpl) => crawlBizinfo({ fetchImpl }),
  kstartup: (fetchImpl) => crawlKstartup({ fetchImpl }),
};

export async function runCrawl(opts: RunCrawlOptions): Promise<RunCrawlResult> {
  const log = opts.log || (() => {});
  const started = new Date();
  const today = opts.today || toISODate(started);
  const sources = (opts.sources || ["bizinfo", "kstartup"]).filter((s): s is Exclude<ProgramSource, "manual"> => s !== "manual");
  const results: CrawlSourceResult[] = [];
  const warnings: string[] = [];
  const newIds: string[] = [];

  for (const source of sources) {
    log(`[${source}] 크롤링 시작`);
    try {
      const out = await CRAWLERS[source](opts.fetchImpl);
      warnings.push(...out.warnings.map((w) => `[${source}] ${w}`));
      const upsert = upsertPrograms(out.programs, started.toISOString());
      newIds.push(...upsert.added_ids);
      results.push({ source, ok: true, method: out.method, fetched: out.programs.length, added: upsert.added, updated: upsert.updated });
      log(`[${source}] ${out.method} 로 ${out.programs.length}건 수집 — 신규 ${upsert.added}, 변경 ${upsert.updated}`);
    } catch (err) {
      const message = (err as Error).message;
      results.push({ source, ok: false, method: "none", fetched: 0, added: 0, updated: 0, error: message });
      warnings.push(`[${source}] 크롤링 실패: ${message}`);
      log(`[${source}] 실패: ${message}`);
    }
  }

  // 신규 공고 점수화
  const profile = getProfile();
  const scored = newIds
    .map((id) => getProgram(id))
    .filter((p): p is SupportProgram => Boolean(p))
    .map((program) => ({ program, match: scoreProgram(program, profile, today) }))
    .filter((x) => x.match.status !== "closed")
    .sort((a, b) => b.match.score - a.match.score);

  // 상위 N건 AI 분석
  const topN = opts.analyzeTopN ?? Number(process.env.SUPPORT_AI_AUTO_ANALYZE_TOP_N || 0);
  const minScore = opts.analyzeMinScore ?? Number(process.env.SUPPORT_AI_AUTO_ANALYZE_MIN_SCORE || 50);
  const analyzedIds: string[] = [];
  if (topN > 0 && isAiConfigured()) {
    for (const item of scored.filter((x) => x.match.score >= minScore).slice(0, topN)) {
      try {
        log(`[ai] 분석: ${item.program.title}`);
        const analysis = await analyzeProgram(item.program, profile, item.match, { today });
        saveAnalysis(analysis);
        analyzedIds.push(item.program.id);
      } catch (err) {
        warnings.push(`[ai] 분석 실패 (${item.program.id}): ${(err as Error).message}`);
      }
    }
  } else if (topN > 0) {
    warnings.push("[ai] ANTHROPIC_API_KEY 미설정 — 자동 AI 분석 생략");
  }

  // 알림
  const digestItems: DigestItem[] = scored.slice(0, 10).map((x) => ({ ...x, analysis: getAnalysis(x.program.id) }));
  let notified = false;
  if (opts.notify ?? true) {
    try {
      const text = buildDigestText(digestItems, { appUrl: process.env.APP_URL, totalNew: newIds.length, when: today });
      notified = await sendWebhook(text, { fetchImpl: opts.fetchImpl });
      if (notified) log("[notify] 웹훅 전송 완료");
    } catch (err) {
      warnings.push(`[notify] ${(err as Error).message}`);
    }
  }

  const crawlLog: CrawlLog = {
    id: uuidv4(),
    trigger: opts.trigger,
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    results,
    new_program_ids: newIds,
    analyzed_program_ids: analyzedIds,
    notified,
  };
  addCrawlLog(crawlLog);
  return { ...crawlLog, warnings, digest_items: digestItems };
}
