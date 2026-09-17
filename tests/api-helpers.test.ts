import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, parseDueDate, toValidDate, todayKey, addDays, parseChecklist, parsePriority, parseTaskStatus, parseVentureStatus } from "../src/lib/hq/validate.ts";
import { PRIORITIES, TASK_STATUSES, VENTURE_STATUSES } from "../src/lib/hq/types.ts";

test("parseDueDate: valid, empty, invalid", () => {
  assert.equal(parseDueDate("2026-09-17"), "2026-09-17");
  assert.equal(parseDueDate(""), null);
  assert.equal(parseDueDate(null), null);
  assert.equal(parseDueDate(undefined), null);
  assert.throws(() => parseDueDate("2026-02-30"), ApiError);
  assert.throws(() => parseDueDate("not-a-date"), ApiError);
  assert.throws(() => parseDueDate(20260917), ApiError);
});

test("toValidDate never throws and rejects impossible dates", () => {
  assert.equal(toValidDate("2026-09-17"), "2026-09-17");
  assert.equal(toValidDate("2026-09-17T00:00:00Z"), "2026-09-17");
  assert.equal(toValidDate("2026-02-30"), null);
  assert.equal(toValidDate("다음 주"), null);
  assert.equal(toValidDate(null), null);
});

test("todayKey respects an IANA zone and falls back on junk", () => {
  const at = new Date("2026-09-17T20:30:00Z"); // 05:30 next day in Seoul
  assert.equal(todayKey("Asia/Seoul", at), "2026-09-18");
  assert.equal(todayKey("UTC", at), "2026-09-17");
  assert.equal(todayKey("America/Los_Angeles", at), "2026-09-17");
  assert.equal(todayKey("Not/AZone", at), todayKey(undefined, at));
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-09-28", 7), "2026-10-05");
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("parseChecklist accepts strings and items, drops blanks", () => {
  const items = parseChecklist(["시안 A", "  ", { id: "x", text: "시안 B", done: true }, { text: "" }, 42]);
  assert.equal(items.length, 2);
  assert.equal(items[0].text, "시안 A");
  assert.equal(items[0].done, false);
  assert.ok(items[0].id);
  assert.deepEqual(items[1], { id: "x", text: "시안 B", done: true });
});

test("enum parsers: missing → fallback, invalid → 400", () => {
  assert.equal(parsePriority(undefined), "P2");
  assert.equal(parsePriority("", "P1"), "P1");
  assert.equal(parsePriority("P0"), "P0");
  assert.throws(() => parsePriority("P9"), ApiError);
  assert.equal(parseTaskStatus(null, "doing"), "doing");
  assert.throws(() => parseTaskStatus("finished"), ApiError);
});

test("enum lists in validate.ts match types.ts", () => {
  for (const p of PRIORITIES) assert.equal(parsePriority(p), p);
  for (const st of TASK_STATUSES) assert.equal(parseTaskStatus(st), st);
  for (const vs of VENTURE_STATUSES) assert.equal(parseVentureStatus(vs), vs);
});
