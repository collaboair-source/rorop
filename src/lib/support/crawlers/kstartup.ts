// K-Startup(창업진흥원, k-startup.go.kr) 창업지원사업 공고 크롤러
//
// 1순위: 공공데이터포털 Open API "창업진흥원_K-Startup 창업지원사업 공고 정보"
//   - https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01
//   - data.go.kr 에서 활용신청 후 발급되는 서비스키 (환경변수 DATA_GO_KR_SERVICE_KEY)
//   - 인코딩/디코딩 키 모두 허용 (자동 판별)
// 2순위: 키가 없거나 API 가 실패하면 "모집중 공고" 목록 HTML 파싱 (레이아웃 변경에 취약)

import type { CrawlMethod, SupportProgram } from "../types";
import { fetchJson, fetchText, sleep, type FetchLike } from "../http";
import { buildProgram, extractLabeledSections, mergeDetail } from "../normalize";
import { parseDate, parseDateRange, pick, splitList, stripHtml, toISODate, truncate } from "../text";
import type { CrawlOutput } from "./bizinfo";

export const KSTARTUP_BASE = "https://www.k-startup.go.kr";
export const KSTARTUP_API_URL = "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";
export const KSTARTUP_LIST_URL = `${KSTARTUP_BASE}/web/contents/bizpbanc-ongoing.do`;

export interface KstartupOptions {
  serviceKey?: string;
  perPage?: number;
  maxPages?: number;
  pages?: number; // HTML 폴백 시 목록 페이지 수
  detailLimit?: number;
  fetchImpl?: FetchLike;
  delayMs?: number;
  today?: string; // 테스트용 YYYY-MM-DD
}

export async function crawlKstartup(opts: KstartupOptions = {}): Promise<CrawlOutput> {
  const warnings: string[] = [];
  const serviceKey = opts.serviceKey ?? process.env.DATA_GO_KR_SERVICE_KEY;

  if (serviceKey) {
    try {
      const programs = await fetchKstartupApi(serviceKey, opts);
      return { programs, method: "api", warnings };
    } catch (err) {
      warnings.push(`K-Startup API 실패, HTML 로 폴백: ${(err as Error).message}`);
    }
  } else {
    warnings.push("DATA_GO_KR_SERVICE_KEY 미설정 — K-Startup 목록 HTML 파싱으로 동작");
  }

  const programs = await fetchKstartupHtml(opts, warnings);
  return { programs, method: "html", warnings };
}

// ---------- Open API (공공데이터포털) ----------

interface OdcloudResponse {
  currentCount?: number;
  matchCount?: number;
  page?: number;
  perPage?: number;
  totalCount?: number;
  data?: Record<string, unknown>[];
  // 오류 시
  code?: number | string;
  msg?: string;
  message?: string;
}

export async function fetchKstartupApi(serviceKey: string, opts: KstartupOptions = {}): Promise<SupportProgram[]> {
  const perPage = opts.perPage ?? 100;
  const maxPages = opts.maxPages ?? 5;
  const today = opts.today ?? toISODate(new Date());
  const keyParam = /%[0-9A-Fa-f]{2}/.test(serviceKey) ? serviceKey : encodeURIComponent(serviceKey);

  const programs: SupportProgram[] = [];
  let useOngoingFilter = true;
  for (let page = 1; page <= maxPages; page++) {
    const build = (withFilter: boolean) => {
      const qs = [`serviceKey=${keyParam}`, `page=${page}`, `perPage=${perPage}`, `returnType=json`];
      if (withFilter) qs.push(`cond%5Brcrt_prgs_yn%3A%3AEQ%5D=Y`);
      return `${KSTARTUP_API_URL}?${qs.join("&")}`;
    };
    let json = await fetchJson<OdcloudResponse>(build(useOngoingFilter), { fetchImpl: opts.fetchImpl });
    if (!Array.isArray(json.data) && useOngoingFilter) {
      // 조건 파라미터를 거부하는 경우 필터 없이 재시도
      useOngoingFilter = false;
      json = await fetchJson<OdcloudResponse>(build(false), { fetchImpl: opts.fetchImpl });
    }
    if (!Array.isArray(json.data)) {
      const msg = json.msg || json.message || truncate(JSON.stringify(json), 200);
      throw new Error(`예상하지 못한 응답: ${msg}`);
    }
    for (const item of json.data) {
      const p = parseKstartupApiItem(item);
      if (!p) continue;
      // 마감된 공고는 제외 (모집 종료 or 종료일 경과)
      const ongoingFlag = pick(item, ["rcrt_prgs_yn", "rcrtPrgsYn"]).toUpperCase();
      if (ongoingFlag === "N") continue;
      if (p.apply_end && p.apply_end < today) continue;
      programs.push(p);
    }
    if (json.data.length < perPage) break;
    await sleep(opts.delayMs ?? 200);
  }
  return programs;
}

/** 공공데이터포털 항목 → SupportProgram. 필수값(공고번호, 공고명)이 없으면 null */
export function parseKstartupApiItem(item: Record<string, unknown>): SupportProgram | null {
  const externalId = pick(item, ["pbanc_sn", "pbancSn", "PBANC_SN"]);
  const title = stripHtml(pick(item, ["biz_pbanc_nm", "bizPbancNm", "intg_pbanc_biz_nm", "title"]));
  if (!externalId || !title) return null;

  const applyMethods = [
    ["온라인", pick(item, ["aply_mthd_onli_rcpt_istc"])],
    ["방문", pick(item, ["aply_mthd_vst_rcpt_istc"])],
    ["우편", pick(item, ["aply_mthd_pssr_rcpt_istc"])],
    ["팩스", pick(item, ["aply_mthd_fax_rcpt_istc"])],
    ["이메일", pick(item, ["aply_mthd_eml_rcpt_istc"])],
    ["기타", pick(item, ["aply_mthd_etc_istc"])],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const detailUrl = pick(item, ["detl_pg_url", "detlPgUrl"]);
  const guideUrl = pick(item, ["biz_gdnc_url", "bizGdncUrl"]);
  const url = detailUrl || guideUrl || `${KSTARTUP_LIST_URL}?schM=view&pbancSn=${externalId}`;
  const preference = pick(item, ["prfn_matr", "prfnMatr"]);
  const contactParts = [pick(item, ["biz_prch_dprt_nm"]), pick(item, ["prch_cnpl_no"])].filter(Boolean);

  const summaryParts = [pick(item, ["pbanc_ctnt", "pbancCtnt"]), preference ? `우대사항: ${preference}` : ""].filter(Boolean);

  return buildProgram({
    source: "kstartup",
    external_id: externalId,
    title,
    summary: summaryParts.join("\n\n"),
    category: pick(item, ["supt_biz_clsfc", "suptBizClsfc"]),
    subcategory: pick(item, ["intg_pbanc_biz_nm", "intgPbancBizNm"]),
    target: pick(item, ["aply_trgt", "aplyTrgt"]),
    target_detail: pick(item, ["aply_trgt_ctnt", "aplyTrgtCtnt"]),
    exclusion: pick(item, ["aply_excl_trgt_ctnt", "aplyExclTrgtCtnt"]),
    region: pick(item, ["supt_regin", "suptRegin"]),
    business_age: pick(item, ["biz_enyy", "bizEnyy"]),
    target_age: pick(item, ["biz_trgt_age", "bizTrgtAge"]),
    organization: pick(item, ["pbanc_ntrp_nm", "pbancNtrpNm"]),
    executing_org: pick(item, ["sprv_inst", "sprvInst"]),
    department: pick(item, ["biz_prch_dprt_nm", "bizPrchDprtNm"]),
    apply_start: parseDate(pick(item, ["pbanc_rcpt_bgng_dt", "pbancRcptBgngDt"])),
    apply_end: parseDate(pick(item, ["pbanc_rcpt_end_dt", "pbancRcptEndDt"])),
    apply_method: applyMethods,
    contact: contactParts.join(" / "),
    url,
    hashtags: splitList(pick(item, ["supt_biz_clsfc"])).concat(splitList(pick(item, ["supt_regin"]))),
    attachments: guideUrl && guideUrl !== url ? [{ name: "사업안내", url: guideUrl }] : [],
    posted_at: parseDate(pick(item, ["pbanc_ntrp_dt", "reg_dt", "frst_reg_dt"])),
  });
}

// ---------- HTML fallback ----------

async function fetchKstartupHtml(opts: KstartupOptions, warnings: string[]): Promise<SupportProgram[]> {
  const pages = opts.pages ?? 3;
  const delay = opts.delayMs ?? 400;
  let programs: SupportProgram[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${KSTARTUP_LIST_URL}?page=${page}`;
    const html = await fetchText(url, { fetchImpl: opts.fetchImpl });
    const parsed = parseKstartupListHtml(html);
    if (parsed.length === 0) {
      if (page === 1) warnings.push("K-Startup 목록 HTML 에서 공고를 찾지 못했습니다 (레이아웃 변경 가능성)");
      break;
    }
    programs = programs.concat(parsed);
    if (page < pages) await sleep(delay);
  }
  const seen = new Set<string>();
  programs = programs.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  const detailLimit = opts.detailLimit ?? 30;
  let fetched = 0;
  for (let i = 0; i < programs.length && fetched < detailLimit; i++) {
    try {
      const html = await fetchText(programs[i].url, { fetchImpl: opts.fetchImpl });
      programs[i] = mergeDetail(programs[i], parseKstartupDetailHtml(html));
      fetched += 1;
      await sleep(delay);
    } catch (err) {
      warnings.push(`상세 페이지 실패 (${programs[i].external_id}): ${(err as Error).message}`);
    }
  }
  return programs;
}

/** 모집중 공고 목록 HTML: pbancSn 링크를 기준으로 카드 블록을 잘라 파싱 */
export function parseKstartupListHtml(html: string): SupportProgram[] {
  const programs: SupportProgram[] = [];
  const seen = new Set<string>();

  // 카드형 (<li> ... pbancSn ... </li>) 우선
  const blocks = html.match(/<li[\s\S]*?<\/li>/gi) || [];
  for (const block of blocks) {
    const idMatch = block.match(/pbancSn=(\d+)/i);
    if (!idMatch) continue;
    const externalId = idMatch[1];
    if (seen.has(externalId)) continue;
    const titleMatch = block.match(/<p[^>]*class="[^"]*tit[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || block.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const title = stripHtml(titleMatch ? titleMatch[1] : "");
    if (!title) continue;
    seen.add(externalId);
    // 인라인 태그(span 등)로 나열된 "라벨 : 값" 항목을 줄 단위로 분리
    const text = stripHtml(block.replace(/<\/(span|a|strong|em|b|dd|dt)>/gi, "\n"));
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const range = parseDateRange(lines.find((l) => /~|∼/.test(l) && /\d{4}/.test(l)) || "");
    const raw = extractLabeledSections(text, ["기관명", "주관기관", "접수기간", "지역", "대상", "업력", "연령", "지원분야"], 300);
    // 카드의 각 항목은 한 줄이므로 첫 줄만 취한다 ("상세보기" 같은 꼬리 제거)
    const labeled: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) labeled[k] = v.split("\n")[0].trim();
    programs.push(
      buildProgram({
        source: "kstartup",
        external_id: externalId,
        title,
        organization: labeled["기관명"] || labeled["주관기관"] || "",
        region: labeled["지역"] || "",
        target: labeled["대상"] || "",
        business_age: labeled["업력"] || "",
        target_age: labeled["연령"] || "",
        category: labeled["지원분야"] || "",
        apply_start: range.start,
        apply_end: range.end,
        url: `${KSTARTUP_LIST_URL}?schM=view&pbancSn=${externalId}`,
      })
    );
  }
  if (programs.length > 0) return programs;

  // 링크만이라도
  const anchorRe = /<a[^>]*pbancSn=(\d+)[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const externalId = m[1];
    const title = stripHtml(m[2]);
    if (!title || seen.has(externalId)) continue;
    seen.add(externalId);
    programs.push(
      buildProgram({ source: "kstartup", external_id: externalId, title, url: `${KSTARTUP_LIST_URL}?schM=view&pbancSn=${externalId}` })
    );
  }
  return programs;
}

const DETAIL_LABELS = ["사업개요", "사업내용", "지원내용", "신청대상", "지원대상", "제외대상", "신청제외대상", "접수기간", "신청기간", "신청방법", "제출서류", "문의처", "담당부서", "지원지역", "사업경력", "대상연령", "지원분야", "우대사항", "선정절차", "공고기관", "주관기관"];

export function parseKstartupDetailHtml(html: string): Partial<SupportProgram> {
  const text = stripHtml(html);
  const sec = extractLabeledSections(text, DETAIL_LABELS);
  const range = parseDateRange(sec["접수기간"] || sec["신청기간"] || "");
  const summaryParts = [sec["사업개요"], sec["사업내용"], sec["지원내용"], sec["우대사항"] ? `우대사항: ${sec["우대사항"]}` : "", sec["선정절차"]].filter(Boolean);
  return {
    summary: summaryParts.join("\n\n").slice(0, 4000),
    target: sec["지원대상"] || sec["신청대상"] || "",
    target_detail: sec["신청대상"] || "",
    exclusion: sec["제외대상"] || sec["신청제외대상"] || "",
    region: sec["지원지역"] || "",
    business_age: sec["사업경력"] || "",
    target_age: sec["대상연령"] || "",
    category: sec["지원분야"] || "",
    apply_start: range.start,
    apply_end: range.end,
    apply_method: [sec["신청방법"], sec["제출서류"]].filter(Boolean).join("\n").slice(0, 2000),
    contact: [sec["담당부서"], sec["문의처"]].filter(Boolean).join(" / "),
    organization: sec["공고기관"] || "",
    executing_org: sec["주관기관"] || "",
  };
}
