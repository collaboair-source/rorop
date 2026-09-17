// 기업마당(비즈인포, bizinfo.go.kr) 지원사업 크롤러
//
// 1순위: 기업마당 공식 Open API (JSON)
//   - https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=...&dataType=json&searchCnt=...
//   - 인증키(crtfcKey)는 기업마당 로그인 > 마이페이지 > Open API 인증키 발급 에서 무료 발급
//   - 환경변수 BIZINFO_API_KEY
// 2순위: 인증키가 없거나 API 가 실패하면 공고 목록 HTML 을 직접 파싱 (레이아웃 변경에 취약)

import type { CrawlMethod, SupportProgram } from "../types";
import { fetchJson, fetchText, sleep, type FetchLike } from "../http";
import { buildProgram, extractLabeledSections, mergeDetail } from "../normalize";
import { parseDate, parseDateRange, pick, splitList, stripHtml, truncate, uniq } from "../text";
import { REGION_OPTIONS } from "../profile-default";

export const BIZINFO_BASE = "https://www.bizinfo.go.kr";
export const BIZINFO_API_URL = `${BIZINFO_BASE}/uss/rss/bizinfoApi.do`;
export const BIZINFO_LIST_URL = `${BIZINFO_BASE}/web/lay1/bbs/S1T122C128/AS/74/list.do`;
export const BIZINFO_VIEW_URL = `${BIZINFO_BASE}/web/lay1/bbs/S1T122C128/AS/74/view.do`;

export interface BizinfoOptions {
  apiKey?: string;
  count?: number; // API 최대 조회 건수
  pages?: number; // HTML 폴백 시 목록 페이지 수
  detailLimit?: number; // 상세 페이지를 추가로 읽을 최대 건수 (HTML 폴백)
  fetchImpl?: FetchLike;
  delayMs?: number;
}

export interface CrawlOutput {
  programs: SupportProgram[];
  method: CrawlMethod;
  warnings: string[];
}

export async function crawlBizinfo(opts: BizinfoOptions = {}): Promise<CrawlOutput> {
  const warnings: string[] = [];
  const apiKey = opts.apiKey ?? process.env.BIZINFO_API_KEY;

  if (apiKey) {
    try {
      const programs = await fetchBizinfoApi(apiKey, opts);
      return { programs, method: "api", warnings };
    } catch (err) {
      warnings.push(`기업마당 API 실패, HTML 로 폴백: ${(err as Error).message}`);
    }
  } else {
    warnings.push("BIZINFO_API_KEY 미설정 — 기업마당 목록 HTML 파싱으로 동작");
  }

  const programs = await fetchBizinfoHtml(opts, warnings);
  return { programs, method: "html", warnings };
}

// ---------- Open API ----------

export async function fetchBizinfoApi(apiKey: string, opts: BizinfoOptions = {}): Promise<SupportProgram[]> {
  const params = new URLSearchParams({
    crtfcKey: apiKey,
    dataType: "json",
    searchCnt: String(opts.count ?? 300),
  });
  const json = await fetchJson<unknown>(`${BIZINFO_API_URL}?${params.toString()}`, { fetchImpl: opts.fetchImpl });
  const items = extractApiItems(json);
  if (!items) throw new Error(`예상하지 못한 응답 형식: ${truncate(JSON.stringify(json), 200)}`);
  const programs: SupportProgram[] = [];
  for (const item of items) {
    const p = parseBizinfoApiItem(item);
    if (p) programs.push(p);
  }
  return programs;
}

function extractApiItems(json: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const key of ["jsonArray", "items", "item", "data", "list"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
    // 오류 응답 (예: 인증키 오류) 은 메시지를 그대로 노출
    const msg = pick(obj, ["resultMsg", "message", "msg", "error"]);
    if (msg) throw new Error(msg);
  }
  return null;
}

/** 기업마당 API 항목 → SupportProgram. 필수값(공고ID, 공고명)이 없으면 null */
export function parseBizinfoApiItem(item: Record<string, unknown>): SupportProgram | null {
  const externalId = pick(item, ["pblancId", "pblancid", "PBLANC_ID"]);
  const title = stripHtml(pick(item, ["pblancNm", "pblancnm", "PBLANC_NM", "title"]));
  if (!externalId || !title) return null;

  const range = parseDateRange(pick(item, ["reqstBeginEndDe", "reqstbeginendde", "REQST_BEGIN_END_DE"]));
  const hashtags = splitList(pick(item, ["hashtags", "hashTags", "HASHTAGS"]));
  const rawUrl = pick(item, ["pblancUrl", "pblancurl", "PBLANC_URL", "link"]);
  const url = rawUrl ? absolutize(rawUrl) : `${BIZINFO_VIEW_URL}?pblancId=${externalId}`;

  const attachments = [];
  const printName = pick(item, ["printFileNm", "printfilenm"]);
  const printPath = pick(item, ["printFlpthNm", "printflpthnm"]);
  if (printName && printPath) attachments.push({ name: printName, url: absolutize(printPath) });
  const fileName = pick(item, ["fileNm", "filenm"]);
  const filePath = pick(item, ["flpthNm", "flpthnm"]);
  if (fileName && filePath) attachments.push({ name: fileName, url: absolutize(filePath) });

  return buildProgram({
    source: "bizinfo",
    external_id: externalId,
    title,
    summary: pick(item, ["bsnsSumryCn", "bsnssumrycn", "BSNS_SUMRY_CN", "description"]),
    category: pick(item, ["pldirSportRealmLclasCodeNm", "pldirsportrealmlclascodenm"]),
    subcategory: pick(item, ["pldirSportRealmMlsfcCodeNm", "pldirsportrealmmlsfccodenm"]),
    target: pick(item, ["trgetNm", "trgetnm", "TRGET_NM"]),
    region: regionFromHashtags(hashtags),
    organization: pick(item, ["jrsdInsttNm", "jrsdinsttnm", "JRSD_INSTT_NM"]),
    executing_org: pick(item, ["excInsttNm", "excinsttnm", "EXC_INSTT_NM"]),
    apply_start: range.start,
    apply_end: range.end,
    apply_method: pick(item, ["reqstMthPapersCn", "reqstmthpaperscn"]),
    contact: pick(item, ["refrncNm", "refrncnm", "REFRNC_NM"]),
    url,
    hashtags,
    attachments,
    posted_at: parseDate(pick(item, ["creatPnttm", "creatpnttm", "CREAT_PNTTM", "pubDate"])),
  });
}

// ---------- HTML fallback ----------

async function fetchBizinfoHtml(opts: BizinfoOptions, warnings: string[]): Promise<SupportProgram[]> {
  const pages = opts.pages ?? 3;
  const delay = opts.delayMs ?? 400;
  let programs: SupportProgram[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${BIZINFO_LIST_URL}?rows=100&cpage=${page}`;
    const html = await fetchText(url, { fetchImpl: opts.fetchImpl });
    const parsed = parseBizinfoListHtml(html);
    if (parsed.length === 0) {
      if (page === 1) warnings.push("기업마당 목록 HTML 에서 공고를 찾지 못했습니다 (레이아웃 변경 가능성)");
      break;
    }
    programs = programs.concat(parsed);
    if (page < pages) await sleep(delay);
  }
  // 중복 제거
  const seen = new Set<string>();
  programs = programs.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  const detailLimit = opts.detailLimit ?? 30;
  let fetched = 0;
  for (let i = 0; i < programs.length && fetched < detailLimit; i++) {
    try {
      const html = await fetchText(programs[i].url, { fetchImpl: opts.fetchImpl });
      programs[i] = mergeDetail(programs[i], parseBizinfoDetailHtml(html));
      fetched += 1;
      await sleep(delay);
    } catch (err) {
      warnings.push(`상세 페이지 실패 (${programs[i].external_id}): ${(err as Error).message}`);
    }
  }
  return programs;
}

/** 목록 HTML 에서 공고 링크(pblancId)와 같은 행의 셀 정보를 최대한 추출 */
export function parseBizinfoListHtml(html: string): SupportProgram[] {
  const programs: SupportProgram[] = [];
  const seen = new Set<string>();

  // 1) 테이블 행 단위 파싱
  const rowRe = /<tr[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRe) || [];
  for (const row of rows) {
    const link = row.match(/href="([^"]*?pblancId=([A-Za-z0-9_\-]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const externalId = link[2];
    if (seen.has(externalId)) continue;
    const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || []).map((c) => stripHtml(c));
    const title = stripHtml(link[3]);
    if (!title) continue;
    seen.add(externalId);

    const titleIdx = cells.findIndex((c) => c.includes(title.slice(0, Math.min(title.length, 15))));
    let category = "";
    if (titleIdx > 0 && !/^\d+$/.test(cells[titleIdx - 1])) category = cells[titleIdx - 1];
    let applyStart: string | null = null;
    let applyEnd: string | null = null;
    let postedAt: string | null = null;
    const orgs: string[] = [];
    for (let i = titleIdx + 1; i < cells.length; i++) {
      const c = cells[i];
      if (/~|∼/.test(c) && /\d{4}/.test(c)) {
        const r = parseDateRange(c);
        applyStart = r.start;
        applyEnd = r.end;
      } else if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(c)) {
        postedAt = parseDate(c);
      } else if (/^\d+$/.test(c) || !c) {
        // 조회수 등
      } else {
        orgs.push(c);
      }
    }
    programs.push(
      buildProgram({
        source: "bizinfo",
        external_id: externalId,
        title,
        category,
        organization: orgs[0] || "",
        executing_org: orgs[1] || "",
        apply_start: applyStart,
        apply_end: applyEnd,
        posted_at: postedAt,
        url: absolutize(link[1].replace(/&amp;/g, "&")),
      })
    );
  }
  if (programs.length > 0) return programs;

  // 2) 테이블이 아니면 링크만이라도
  const anchorRe = /href="([^"]*?pblancId=([A-Za-z0-9_\-]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const externalId = m[2];
    const title = stripHtml(m[3]);
    if (!title || seen.has(externalId)) continue;
    seen.add(externalId);
    programs.push(
      buildProgram({ source: "bizinfo", external_id: externalId, title, url: absolutize(m[1].replace(/&amp;/g, "&")) })
    );
  }
  return programs;
}

const DETAIL_LABELS = ["사업개요", "사업목적", "지원내용", "지원대상", "지원규모", "신청기간", "접수기간", "신청방법", "제출서류", "문의처", "지원분야", "소관부처", "사업수행기관", "선정절차", "지원제외대상", "제외대상"];

/** 상세 HTML 에서 라벨 기반으로 개요/대상/기간 등을 추출 */
export function parseBizinfoDetailHtml(html: string): Partial<SupportProgram> {
  const text = stripHtml(html);
  const sec = extractLabeledSections(text, DETAIL_LABELS);
  const range = parseDateRange(sec["신청기간"] || sec["접수기간"] || "");
  const summaryParts = [sec["사업개요"], sec["사업목적"], sec["지원내용"], sec["지원규모"], sec["선정절차"]].filter(Boolean);
  return {
    summary: summaryParts.join("\n\n").slice(0, 4000),
    target: sec["지원대상"] || "",
    exclusion: sec["지원제외대상"] || sec["제외대상"] || "",
    apply_start: range.start,
    apply_end: range.end,
    apply_method: [sec["신청방법"], sec["제출서류"]].filter(Boolean).join("\n").slice(0, 2000),
    contact: sec["문의처"] || "",
    category: sec["지원분야"] || "",
    organization: sec["소관부처"] || "",
    executing_org: sec["사업수행기관"] || "",
  };
}

// ---------- helpers ----------

function absolutize(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${BIZINFO_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function regionFromHashtags(hashtags: string[]): string {
  const regions = uniq(hashtags.filter((h) => h === "전국" || REGION_OPTIONS.some((r) => h.startsWith(r))));
  return regions.join(",");
}
