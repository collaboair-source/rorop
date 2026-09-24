// Drive the app in headless Chromium and capture screenshots of every HQ page.
// Usage: BASE=http://localhost:3000 OUT=/tmp/shots node scripts/screenshots.mjs
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "./screenshots";
fs.mkdirSync(OUT, { recursive: true });

// Set CHROMIUM=/path/to/chrome to use a system browser; otherwise Playwright's bundled Chromium (npx playwright install chromium).
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const results = [];
for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 375, height: 812 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

  const email = `shot-${label}-${Date.now()}@example.com`;
  await page.goto(`${BASE}/register`);
  await page.fill('input[type="text"]', "대표");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "secret123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/hq|\/dashboard/, { timeout: 30000 });

  // seed some data through the API using the browser's cookie
  const seed = await page.evaluate(async () => {
    const post = (p, b) => fetch(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
    const v = (await post("/api/hq/ventures", { name: "카페 브랜딩", summary: "동네 카페 로고와 간판 디자인", goal: "10월 오픈 전 납품", priority: "P1" })).venture;
    const today = new Date(); const k = (d) => d.toISOString().slice(0, 10);
    const y = new Date(today); y.setDate(today.getDate() - 2);
    const t = (await post("/api/hq/tasks", { title: "로고 시안 3개 보내기", venture_id: v.id, priority: "P0", due_date: k(today), checklist: ["시안 A", "시안 B", "시안 C"], description: "클라이언트 미팅 전까지" })).task;
    await post("/api/hq/tasks", { title: "간판 견적 받기", venture_id: v.id, priority: "P1", due_date: k(y) });
    await post("/api/hq/tasks", { title: "인스타 계정 만들기", venture_id: v.id, priority: "P3" });
    await post("/api/hq/comments", { target_type: "task", target_id: t.id, body: "클라이언트가 **A안** 선호. 색은 웜톤으로." });
    const imp = await post("/api/hq/knowledge", { items: [{ kind: "conversation", title: "카페 로고 아이디어 대화", content: "### 나\n카페 로고 만들고 싶어\n\n### Claude\n세 가지 방향을 제안합니다: 미니멀, 레트로, 손글씨.", source_uuid: "shot-1", source_date: "2026-09-01T00:00:00Z" }] });
    return { v: v.id, t: t.id, k: imp.items[0].id };
  });

  const pages = [
    ["hq", "/hq"],
    ["ventures", "/hq/ventures"],
    ["venture-detail", `/hq/ventures/${seed.v}`],
    ["tasks", "/hq/tasks"],
    ["task-detail", `/hq/tasks/${seed.t}`],
    ["secretary", "/hq/secretary"],
    ["import", "/hq/import"],
    ["knowledge-detail", `/hq/knowledge/${seed.k}`],
    ["search", "/hq/search?q=" + encodeURIComponent("로고")],
    ["settings", "/hq/settings"],
  ];
  for (const [name, path] of pages) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    const file = `${OUT}/${label}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    results.push({ label, name, path, file, hasHScroll });
    console.log(`${label} ${name}: ${file}${hasHScroll ? "  (HORIZONTAL SCROLL!)" : ""}`);
  }
  if (errors.length) console.log(`${label} errors:\n  ${errors.join("\n  ")}`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
