import { chromium } from "playwright";
// UI end-to-end check against a running server. Usage: BASE=http://localhost:3000 node scripts/e2e-ui.mjs
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };

await page.goto(`${BASE}/register`);
await page.fill('input[type="text"]', "대표");
await page.fill('input[type="email"]', `ix-${Date.now()}@example.com`);
await page.fill('input[type="password"]', "secret123");
await page.click('button[type="submit"]');
await page.waitForURL(/\/hq/);

const seed = await page.evaluate(async () => {
  const post = (p, b) => fetch(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  const v = (await post("/api/hq/ventures", { name: "카페 브랜딩" })).venture;
  const today = new Date().toISOString().slice(0, 10);
  const t1 = (await post("/api/hq/tasks", { title: "로고 시안 보내기", venture_id: v.id, priority: "P0", due_date: today })).task;
  const t2 = (await post("/api/hq/tasks", { title: "간판 견적 받기", venture_id: v.id, priority: "P1" })).task;
  const t3 = (await post("/api/hq/tasks", { title: "완료된 일", priority: "P3" })).task;
  await fetch(`/api/hq/tasks/${t3.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
  return { v: v.id, t1: t1.id, t2: t2.id };
});

// --- tasks list: default (open) shows 2
await page.goto(`${BASE}/hq/tasks`);
await page.waitForSelector("text=개 표시");
check((await page.textContent("body")).includes("2개 표시"), "open filter shows 2 tasks");

// search debounce → URL q
await page.fill('input[aria-label="할 일 검색"]', "간판");
await page.waitForFunction(() => location.search.includes("q="), null, { timeout: 5000 });
await page.waitForFunction(() => document.body.innerText.includes("1개 표시"), null, { timeout: 5000 });
check(decodeURIComponent(page.url()).includes("q=간판"), "search updates URL q");
check((await page.textContent("body")).includes("간판 견적 받기") && !(await page.textContent("body")).includes("로고 시안 보내기"), "search filters list");
check(await page.inputValue('input[aria-label="할 일 검색"]') === "간판", "search box keeps typed text after URL update");

// status chip → URL, list
await page.click('button[role="tab"]:has-text("완료")');
await page.waitForFunction(() => location.search.includes("status=done"), null, { timeout: 5000 });
await page.waitForFunction(() => document.body.innerText.includes("0개 표시") || document.body.innerText.includes("1개 표시"), null, { timeout: 5000 });
check(page.url().includes("status=done"), "status chip updates URL");

// clear filters → URL empty, search box cleared
await page.click('button:has-text("필터 지우기")');
await page.waitForFunction(() => !location.search, null, { timeout: 5000 });
await page.waitForFunction(() => document.body.innerText.includes("2개 표시"), null, { timeout: 5000 });
check(await page.inputValue('input[aria-label="할 일 검색"]') === "", "clearing filters empties the search box");

// direct link with filter
await page.goto(`${BASE}/hq/tasks?status=done`);
await page.waitForFunction(() => document.body.innerText.includes("1개 표시"), null, { timeout: 5000 });
check((await page.textContent("body")).includes("완료된 일"), "direct link ?status=done shows the done task");

// back navigation restores previous filters
await page.goBack();
await page.waitForTimeout(1500);
const afterBack = page.url();
check(!new URL(afterBack).search, `back navigation returns to the unfiltered list (url: ${afterBack})`);
await page.waitForFunction(() => document.body.innerText.includes("2개 표시"), null, { timeout: 5000 }).catch(() => {});
check((await page.textContent("body")).includes("2개 표시"), "back navigation re-applies filters from URL");

// toggle a task done inline → moves to done group
await page.click(`text=간판 견적 받기 >> xpath=../../.. >> input[type=checkbox]`).catch(() => {});
await page.waitForTimeout(600);

// detail navigation between two tasks (keyed component resets)
await page.goto(`${BASE}/hq/tasks/${seed.t1}`);
await page.waitForSelector("text=로고 시안 보내기");
await page.goto(`${BASE}/hq/tasks/${seed.t2}`);
await page.waitForSelector("text=간판 견적 받기");
check(!(await page.textContent("body")).includes("로고 시안 보내기"), "task detail switches cleanly between ids");

// command center retry + venture detail
await page.goto(`${BASE}/hq/ventures/${seed.v}`);
await page.waitForSelector("text=카페 브랜딩");
await page.fill('input[placeholder="할 일 추가"]', "명함 디자인");
await page.click('button:has-text("추가")');
await page.waitForSelector("text=명함 디자인");
check(true, "venture quick-add renders new task");

await page.goto(`${BASE}/hq`);
await page.waitForSelector("text=오늘 집중");
await page.fill('input[placeholder="지금 바로 잡을 할 일"]', "투자자 미팅 준비");
await page.click('button:has-text("추가")');
await page.waitForSelector("text=투자자 미팅 준비");
check(true, "command center quick-add renders new task");

// comment thread on task
await page.goto(`${BASE}/hq/tasks/${seed.t1}`);
await page.fill('textarea[placeholder^="코멘트 남기기"]', "첫 코멘트");
await page.click('button:has-text("남기기")');
await page.waitForSelector("text=첫 코멘트");
check(true, "comment posts and renders");

if (errors.length) { console.log("browser errors:\n  " + errors.join("\n  ")); failures++; }
console.log(failures ? `${failures} FAILURE(S)` : "ALL OK");
await browser.close();
process.exit(failures ? 1 : 0);
