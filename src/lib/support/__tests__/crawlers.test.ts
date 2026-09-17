import { test } from "node:test";
import assert from "node:assert/strict";
import { crawlBizinfo, parseBizinfoApiItem, parseBizinfoDetailHtml, parseBizinfoListHtml } from "../crawlers/bizinfo";
import { crawlKstartup, fetchKstartupApi, parseKstartupApiItem, parseKstartupDetailHtml, parseKstartupListHtml } from "../crawlers/kstartup";
import { mockFetch } from "./helpers";
import {
  BIZINFO_API_ITEM,
  BIZINFO_API_RESPONSE,
  BIZINFO_DETAIL_HTML,
  BIZINFO_LIST_HTML,
  KSTARTUP_API_ITEM,
  KSTARTUP_API_ITEM_CLOSED,
  KSTARTUP_DETAIL_HTML,
  KSTARTUP_LIST_HTML,
} from "./fixtures";

// ---------- 기업마당 ----------

test("bizinfo: API item is normalized", () => {
  const p = parseBizinfoApiItem(BIZINFO_API_ITEM);
  assert.ok(p);
  assert.equal(p.id, "bizinfo:PBLN_000000000098765");
  assert.equal(p.title, "2026년 초기창업패키지 (예비창업자 및 창업 3년 이내 기업) 모집 공고");
  assert.equal(p.apply_start, "2026-09-01");
  assert.equal(p.apply_end, "2026-09-30");
  assert.equal(p.category, "창업");
  assert.equal(p.subcategory, "사업화");
  assert.equal(p.region, "전국");
  assert.deepEqual(p.hashtags, ["전국", "창업", "사업화", "SaaS"]);
  assert.match(p.summary, /예비창업자 및 창업 3년 이내 기업의 사업화 지원/);
  assert.ok(!p.summary.includes("<"));
  assert.equal(p.url, "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_000000000098765");
  assert.equal(p.attachments[0].name, "공고문.hwp");
  assert.equal(p.posted_at, "2026-08-28");
  assert.equal(parseBizinfoApiItem({}), null);
});

test("bizinfo: list HTML rows are parsed", () => {
  const list = parseBizinfoListHtml(BIZINFO_LIST_HTML);
  assert.equal(list.length, 2);
  assert.equal(list[0].external_id, "PBLN_000000000011111");
  assert.equal(list[0].title, "서울시 중소기업 AI 기술개발 지원사업 공고");
  assert.equal(list[0].category, "기술");
  assert.equal(list[0].apply_start, "2026-09-10");
  assert.equal(list[0].apply_end, "2026-10-10");
  assert.equal(list[0].organization, "서울특별시");
  assert.equal(list[0].executing_org, "서울산업진흥원");
  assert.equal(list[0].posted_at, "2026-09-09");
  assert.ok(list[0].url.includes("pblancId=PBLN_000000000011111&page=1"));
  assert.equal(list[1].apply_end, null);
});

test("bizinfo: detail HTML sections are extracted", () => {
  const d = parseBizinfoDetailHtml(BIZINFO_DETAIL_HTML);
  assert.match(d.summary || "", /AI 기술개발 과제/);
  assert.equal(d.target, "서울 소재 창업 7년 이내 중소기업");
  assert.equal(d.exclusion, "휴·폐업 기업, 국세 체납 기업");
  assert.equal(d.apply_end, "2026-10-10");
  assert.equal(d.contact, "서울산업진흥원 02-000-0000");
});

test("bizinfo: API key → api method; API failure falls back to HTML with details", async () => {
  const calls: string[] = [];
  const okFetch = mockFetch({ "bizinfoApi.do": BIZINFO_API_RESPONSE }, calls);
  const viaApi = await crawlBizinfo({ apiKey: "KEY", fetchImpl: okFetch });
  assert.equal(viaApi.method, "api");
  assert.equal(viaApi.programs.length, 1);

  const failing = mockFetch(
    {
      "bizinfoApi.do": () => ({ status: 500, body: "error" }),
      "list.do": BIZINFO_LIST_HTML,
      "view.do": BIZINFO_DETAIL_HTML,
    },
    calls
  );
  const viaHtml = await crawlBizinfo({ apiKey: "KEY", fetchImpl: failing, pages: 1, delayMs: 0, detailLimit: 1 });
  assert.equal(viaHtml.method, "html");
  assert.equal(viaHtml.programs.length, 2);
  assert.ok(viaHtml.warnings.some((w) => w.includes("폴백")));
  // 첫 건만 상세를 읽어 개요/대상이 채워진다
  assert.match(viaHtml.programs[0].summary, /AI 기술개발/);
  assert.equal(viaHtml.programs[0].target, "서울 소재 창업 7년 이내 중소기업");
  assert.equal(viaHtml.programs[1].summary, "");
});

// ---------- K-Startup ----------

test("kstartup: API item is normalized", () => {
  const p = parseKstartupApiItem(KSTARTUP_API_ITEM);
  assert.ok(p);
  assert.equal(p.id, "kstartup:175001");
  assert.equal(p.category, "사업화");
  assert.equal(p.target, "예비창업자");
  assert.equal(p.business_age, "예비창업자");
  assert.equal(p.target_age, "만 20세 이상 ~ 만 39세 이하");
  assert.equal(p.region, "전국");
  assert.equal(p.apply_start, "2026-09-01");
  assert.equal(p.apply_end, "2026-09-25");
  assert.match(p.summary, /우대사항: 여성, 장애인 가점/);
  assert.match(p.apply_method, /온라인: K-Startup/);
  assert.equal(p.contact, "예비창업부 / 044-000-0001");
  assert.equal(p.attachments[0].url, "https://www.k-startup.go.kr/guide/175001");
});

test("kstartup: API pagination, filter fallback and closed-program filtering", async () => {
  const calls: string[] = [];
  const fetchImpl = mockFetch(
    {
      "getAnnouncementInformation01": (url) => {
        // 조건 파라미터가 있으면 거부 → 폴백 확인
        if (url.includes("cond")) return JSON.stringify({ code: -4, msg: "invalid param" });
        const page = Number(new URL(url).searchParams.get("page"));
        if (page === 1) return JSON.stringify({ currentCount: 2, data: [KSTARTUP_API_ITEM, KSTARTUP_API_ITEM_CLOSED], page: 1, perPage: 2, totalCount: 3 });
        return JSON.stringify({ currentCount: 1, data: [{ ...KSTARTUP_API_ITEM, pbanc_sn: "175002", biz_pbanc_nm: "두 번째" }], page: 2, perPage: 2, totalCount: 3 });
      },
    },
    calls
  );
  const programs = await fetchKstartupApi("abc+def/ghi==", { fetchImpl, perPage: 2, maxPages: 5, delayMs: 0, today: "2026-09-17" });
  assert.deepEqual(programs.map((p) => p.external_id), ["175001", "175002"]);
  assert.ok(calls[0].includes("serviceKey=abc%2Bdef%2Fghi%3D%3D"), "디코딩 키는 인코딩해서 보낸다");
  assert.ok(calls.length >= 3);
});

test("kstartup: list HTML cards are parsed", () => {
  const list = parseKstartupListHtml(KSTARTUP_LIST_HTML);
  assert.equal(list.length, 2);
  assert.equal(list[0].external_id, "175100");
  assert.equal(list[0].title, "2026년 서울창업허브 입주기업 모집");
  assert.equal(list[0].organization, "서울경제진흥원");
  assert.equal(list[0].apply_start, "2026-09-15");
  assert.equal(list[0].apply_end, "2026-09-30");
  assert.equal(list[0].region, "서울");
  assert.equal(list[0].target, "창업 7년 이내 기업");
  assert.equal(list[1].external_id, "175101");
  assert.equal(list[1].region, "전국");
});

test("kstartup: detail HTML and full HTML crawl", async () => {
  const d = parseKstartupDetailHtml(KSTARTUP_DETAIL_HTML);
  assert.match(d.summary || "", /입주 공간/);
  assert.equal(d.target, "서울 소재 창업 7년 이내 기업 (SaaS, 플랫폼 우대)");
  assert.equal(d.exclusion, "타 공공 보육공간 입주 기업");

  const fetchImpl = mockFetch({ "schM=view": KSTARTUP_DETAIL_HTML, "bizpbanc-ongoing.do": KSTARTUP_LIST_HTML });
  const out = await crawlKstartup({ serviceKey: "", fetchImpl, pages: 1, delayMs: 0, detailLimit: 5 });
  assert.equal(out.method, "html");
  assert.equal(out.programs.length, 2);
  assert.match(out.programs[0].summary, /입주 공간/);
});
