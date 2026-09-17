import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntil, dueLabel, formatDate, relativeTime, truncate } from "../src/lib/hq/format.ts";

test("daysUntil / dueLabel relative to a fixed today", () => {
  assert.equal(daysUntil("2026-09-17", "2026-09-17"), 0);
  assert.equal(daysUntil("2026-09-20", "2026-09-17"), 3);
  assert.equal(daysUntil("2026-09-15", "2026-09-17"), -2);
  assert.equal(daysUntil(null, "2026-09-17"), null);
  assert.equal(daysUntil("bad", "2026-09-17"), null);
  assert.equal(dueLabel(null), "");
});

test("formatDate handles date-only and ISO strings", () => {
  assert.equal(formatDate("2026-09-17"), "2026.09.17");
  assert.match(formatDate("2026-09-17T12:34:56.000Z"), /^2026\.09\.1[78]$/);
  assert.equal(formatDate(null), "");
});

test("relativeTime buckets", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  assert.equal(relativeTime("2026-09-17T11:59:40Z", now), "방금 전");
  assert.equal(relativeTime("2026-09-17T11:30:00Z", now), "30분 전");
  assert.equal(relativeTime("2026-09-17T09:00:00Z", now), "3시간 전");
  assert.equal(relativeTime("2026-09-15T12:00:00Z", now), "2일 전");
});

test("truncate", () => {
  assert.equal(truncate("abc", 5), "abc");
  assert.equal(truncate("abcdefgh", 5), "abcde…");
});
