import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { __resetStoreForTests, getProgram, listCrawlLogs, listPrograms, upsertPrograms } from "../store";
import { buildProgram } from "../normalize";
import { runCrawl } from "../crawlers";
import { queryPrograms } from "../service";
import { mockFetch } from "./helpers";
import { BIZINFO_API_RESPONSE, KSTARTUP_DETAIL_HTML, KSTARTUP_LIST_HTML } from "./fixtures";

beforeEach(() => {
  __resetStoreForTests(null);
  delete process.env.BIZINFO_API_KEY;
  delete process.env.DATA_GO_KR_SERVICE_KEY;
  delete process.env.NOTIFY_WEBHOOK_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

test("upsert detects added / updated / unchanged", () => {
  const a = buildProgram({ source: "bizinfo", external_id: "A", title: "첫 공고", apply_end: "2026-12-01" });
  const r1 = upsertPrograms([a], "2026-09-10T00:00:00.000Z");
  assert.equal(r1.added, 1);
  const r2 = upsertPrograms([a], "2026-09-17T00:00:00.000Z");
  assert.equal(r2.unchanged, 1);
  assert.equal(getProgram(a.id)?.first_seen_at, "2026-09-10T00:00:00.000Z");
  assert.equal(getProgram(a.id)?.last_seen_at, "2026-09-17T00:00:00.000Z");
  const changed = buildProgram({ source: "bizinfo", external_id: "A", title: "첫 공고 (연장)", apply_end: "2026-12-15" });
  const r3 = upsertPrograms([changed], "2026-09-18T00:00:00.000Z");
  assert.equal(r3.updated, 1);
  assert.equal(getProgram(a.id)?.title, "첫 공고 (연장)");
  assert.equal(getProgram(a.id)?.first_seen_at, "2026-09-10T00:00:00.000Z");
});

test("runCrawl merges both sources, logs, and survives a failing source", async () => {
  process.env.BIZINFO_API_KEY = "KEY";
  const webhookCalls: string[] = [];
  const fetchImpl = mockFetch(
    {
      "bizinfoApi.do": BIZINFO_API_RESPONSE,
      "schM=view": KSTARTUP_DETAIL_HTML,
      "bizpbanc-ongoing.do": KSTARTUP_LIST_HTML,
      "hooks.example": (url) => {
        webhookCalls.push(url);
        return "ok";
      },
    }
  );
  process.env.NOTIFY_WEBHOOK_URL = "https://hooks.example/abc";

  const result = await runCrawl({ trigger: "cli", fetchImpl, today: "2026-09-17" });
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].source, "bizinfo");
  assert.equal(result.results[0].method, "api");
  assert.equal(result.results[0].added, 1);
  assert.equal(result.results[1].source, "kstartup");
  assert.equal(result.results[1].method, "html");
  assert.equal(result.results[1].added, 2);
  assert.equal(result.new_program_ids.length, 3);
  assert.equal(result.notified, true);
  assert.equal(webhookCalls.length, 1);
  assert.equal(listPrograms().length, 3);
  assert.equal(listCrawlLogs().length, 1);

  // 두 번째 실행: 신규 0
  const again = await runCrawl({ trigger: "cli", fetchImpl, today: "2026-09-17", notify: false });
  assert.equal(again.new_program_ids.length, 0);
  assert.equal(listCrawlLogs().length, 2);

  // 한 소스가 죽어도 나머지는 진행
  const broken = mockFetch({ "bizinfoApi.do": () => ({ status: 503, body: "down" }), "list.do": () => ({ status: 503, body: "down" }), "bizpbanc-ongoing.do": KSTARTUP_LIST_HTML, "schM=view": KSTARTUP_DETAIL_HTML });
  const partial = await runCrawl({ trigger: "cli", fetchImpl: broken, today: "2026-09-17", notify: false });
  assert.equal(partial.results[0].ok, false);
  assert.equal(partial.results[1].ok, true);
});

test("queryPrograms searches, filters and sorts", async () => {
  process.env.BIZINFO_API_KEY = "KEY";
  const fetchImpl = mockFetch({ "bizinfoApi.do": BIZINFO_API_RESPONSE, "schM=view": KSTARTUP_DETAIL_HTML, "bizpbanc-ongoing.do": KSTARTUP_LIST_HTML });
  await runCrawl({ trigger: "cli", fetchImpl, today: "2026-09-17", notify: false });

  const all = queryPrograms({ today: "2026-09-17" });
  assert.equal(all.total, 3);
  assert.equal(all.stats.new_this_week, 3);
  assert.ok(all.items[0].match.score >= all.items[1].match.score);

  const search = queryPrograms({ q: "액셀러레이팅", today: "2026-09-17" });
  assert.equal(search.total, 1);
  assert.equal(search.items[0].external_id, "175101");

  const bySource = queryPrograms({ source: "bizinfo", today: "2026-09-17" });
  assert.equal(bySource.total, 1);

  const byDeadline = queryPrograms({ sort: "deadline", today: "2026-09-17" });
  assert.equal(byDeadline.items[0].apply_end, "2026-09-30");
});
