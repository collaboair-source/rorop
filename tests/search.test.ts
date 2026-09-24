import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeQuery, snippetAround, scoreFields } from "../src/lib/hq/search.ts";

test("normalizeQuery lowercases, splits on whitespace, caps at 8 tokens", () => {
  assert.deepEqual(normalizeQuery("  카페   Logo "), ["카페", "logo"]);
  assert.deepEqual(normalizeQuery(""), []);
  assert.equal(normalizeQuery("a b c d e f g h i j").length, 8);
});

test("scoreFields requires every token and takes the best field weight per token", () => {
  const fields = [
    { text: "로고 시안 보내기", weight: 4 },
    { text: "클라이언트 미팅 전까지 웜톤", weight: 1.5 },
  ];
  assert.equal(scoreFields(["로고"], fields), 4);
  assert.equal(scoreFields(["웜톤"], fields), 1.5);
  assert.equal(scoreFields(["로고", "웜톤"], fields), 5.5);
  assert.equal(scoreFields(["로고", "없는단어"], fields), 0);
  assert.equal(scoreFields(["LOGO"], [{ text: "Brand Logo", weight: 2 }]), 2, "case-insensitive");
});

test("snippetAround centres on the first match, collapses whitespace, bounds length", () => {
  const long = `${"앞부분 ".repeat(40)}미니멀한 로고가 좋겠어 ${"뒷부분 ".repeat(40)}`;
  const snip = snippetAround(long, ["미니멀"], 140);
  assert.ok(snip.includes("미니멀"));
  assert.ok(snip.length <= 143, `too long: ${snip.length}`);
  assert.ok(snip.startsWith("…") && snip.endsWith("…"));
  assert.equal(snippetAround("짧은 글", ["없음"], 140), "짧은 글");
  assert.equal(snippetAround("  a   b  ", ["a"], 10), "a b");
});

test("snippets drop transcript headers and markdown markers", () => {
  const snip = snippetAround("### 나\n카페 **로고** 만들고 싶어\n\n### Claude\n- 세 가지 방향", ["로고"], 140);
  assert.equal(snip, "카페 로고 만들고 싶어 세 가지 방향");
});
