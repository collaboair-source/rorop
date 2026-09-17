import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, parseDateRange, splitList, stripHtml } from "../text";
import { extractLabeledSections } from "../normalize";

test("stripHtml removes tags, decodes entities, keeps line breaks", () => {
  const out = stripHtml("<p>지원&nbsp;내용 &amp; 대상</p><br><div>두 번째 &#39;줄&#39;</div><script>x()</script>");
  assert.equal(out, "지원 내용 & 대상\n\n두 번째 '줄'");
});

test("parseDate handles compact, dotted, korean formats", () => {
  assert.equal(parseDate("20260901"), "2026-09-01");
  assert.equal(parseDate("2026.9.1"), "2026-09-01");
  assert.equal(parseDate("2026년 09월 01일"), "2026-09-01");
  assert.equal(parseDate("2026-09-01 10:00:00"), "2026-09-01");
  assert.equal(parseDate("예산 소진시까지"), null);
});

test("parseDateRange handles ranges and open-ended ends", () => {
  assert.deepEqual(parseDateRange("20260901 ~ 20260930"), { start: "2026-09-01", end: "2026-09-30" });
  assert.deepEqual(parseDateRange("2026-09-01 ~ 예산 소진시까지"), { start: "2026-09-01", end: null });
  assert.deepEqual(parseDateRange(""), { start: null, end: null });
});

test("splitList splits hashtags", () => {
  assert.deepEqual(splitList("#전국,#창업, 사업화/SaaS"), ["전국", "창업", "사업화", "SaaS"]);
});

test("extractLabeledSections pulls text after labels", () => {
  const text = "사업개요\n개요 본문\n지원대상\n대상 본문\n문의처: 02-000";
  const sec = extractLabeledSections(text, ["사업개요", "지원대상", "문의처"]);
  assert.equal(sec["사업개요"], "개요 본문");
  assert.equal(sec["지원대상"], "대상 본문");
  assert.equal(sec["문의처"], "02-000");
});
