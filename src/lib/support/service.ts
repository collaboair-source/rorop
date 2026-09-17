// API 라우트 / CLI 가 함께 쓰는 조회 로직: 공고 + 규칙 점수 + AI 분석 요약을 합쳐 검색/정렬한다.

import type { ProgramListItem, ProgramSource, ProgramStatus } from "./types";
import { getProfile, listAnalyses, listCrawlLogs, listPrograms } from "./store";
import { scoreProgram } from "./matching";
import { daysBetween, toISODate } from "./text";

export interface ListQuery {
  q?: string;
  source?: ProgramSource | "all";
  status?: ProgramStatus | "active" | "all"; // active = open + closing_soon + unknown
  minScore?: number;
  sort?: "score" | "deadline" | "newest" | "ai";
  onlyNew?: boolean; // 최근 크롤링에서 새로 들어온 것만
  onlyAnalyzed?: boolean;
  limit?: number;
  offset?: number;
  today?: string;
}

export interface ListResponse {
  items: ProgramListItem[];
  total: number;
  stats: {
    total_programs: number;
    active: number;
    closing_soon: number;
    new_this_week: number;
    analyzed: number;
    last_crawl_at: string | null;
  };
}

export function queryPrograms(query: ListQuery = {}): ListResponse {
  const today = query.today || toISODate(new Date());
  const profile = getProfile();
  const analyses = listAnalyses();
  const logs = listCrawlLogs();
  const lastCrawl = logs[0] || null;
  const lastNewIds = new Set(lastCrawl?.new_program_ids || []);

  const all: ProgramListItem[] = listPrograms().map((p) => {
    const match = scoreProgram(p, profile, today);
    const a = analyses[p.id];
    const firstSeenDays = daysBetween(p.first_seen_at.slice(0, 10), today);
    return {
      ...p,
      match,
      analysis: a ? { fit_score: a.fit_score, fit_level: a.fit_level, recommended_action: a.recommended_action, created_at: a.created_at, profile_hash: a.profile_hash } : null,
      is_new: lastNewIds.has(p.id) || firstSeenDays <= 7,
    };
  });

  const stats = {
    total_programs: all.length,
    active: all.filter((x) => x.match.status !== "closed").length,
    closing_soon: all.filter((x) => x.match.status === "closing_soon").length,
    new_this_week: all.filter((x) => x.is_new && x.match.status !== "closed").length,
    analyzed: Object.keys(analyses).length,
    last_crawl_at: lastCrawl?.finished_at || null,
  };

  let items = all;
  const q = (query.q || "").trim().toLowerCase();
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    items = items.filter((x) => {
      const hay = [x.title, x.summary, x.category, x.subcategory, x.target, x.target_detail, x.region, x.organization, x.executing_org, x.hashtags.join(" ")].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  if (query.source && query.source !== "all") items = items.filter((x) => x.source === query.source);
  const status = query.status || "active";
  if (status === "active") items = items.filter((x) => x.match.status !== "closed");
  else if (status !== "all") items = items.filter((x) => x.match.status === status);
  if (typeof query.minScore === "number" && query.minScore > 0) items = items.filter((x) => x.match.score >= query.minScore!);
  if (query.onlyNew) items = items.filter((x) => x.is_new);
  if (query.onlyAnalyzed) items = items.filter((x) => x.analysis);

  const sort = query.sort || "score";
  items.sort((a, b) => {
    if (sort === "deadline") {
      const da = a.apply_end || "9999-12-31";
      const db = b.apply_end || "9999-12-31";
      return da.localeCompare(db) || b.match.score - a.match.score;
    }
    if (sort === "newest") return b.first_seen_at.localeCompare(a.first_seen_at) || b.match.score - a.match.score;
    if (sort === "ai") return (b.analysis?.fit_score ?? -1) - (a.analysis?.fit_score ?? -1) || b.match.score - a.match.score;
    return b.match.score - a.match.score || (a.apply_end || "9999").localeCompare(b.apply_end || "9999");
  });

  const total = items.length;
  const offset = query.offset || 0;
  const limit = query.limit || 200;
  return { items: items.slice(offset, offset + limit), total, stats };
}
