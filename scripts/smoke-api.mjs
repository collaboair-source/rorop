// End-to-end smoke test for the HQ API against a running server.
// Usage: BASE=http://localhost:3000 node scripts/smoke-api.mjs
const BASE = process.env.BASE || "http://localhost:3000";
let cookie = "";
let failures = 0;

async function call(method, path, body, expect = 200) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  const ok = Array.isArray(expect) ? expect.includes(res.status) : res.status === expect;
  console.log(`${ok ? "ok " : "FAIL"} ${method} ${path} -> ${res.status}${ok ? "" : " " + JSON.stringify(data)}`);
  if (!ok) failures++;
  return data;
}

const email = `smoke-${Date.now()}@example.com`;
await call("GET", "/api/hq/overview", undefined, 401);
await call("POST", "/api/auth/register", { email, password: "secret123", name: "스모크", role: "designer" });
await call("GET", "/api/hq/status");
const overview0 = await call("GET", "/api/hq/overview");
if (overview0.stats.open_tasks !== 0) { console.log("FAIL fresh user should have 0 tasks"); failures++; }

const v = (await call("POST", "/api/hq/ventures", { name: "카페 브랜딩", summary: "동네 카페 로고/간판", goal: "10월 오픈", priority: "P1", tags: ["디자인", "브랜딩"] }, 201)).venture;
await call("POST", "/api/hq/ventures", { name: "" }, 400);
const vs = await call("GET", "/api/hq/ventures");
if (vs.ventures.length !== 1) { console.log("FAIL expected 1 venture"); failures++; }

const today = new Date();
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
const t1 = (await call("POST", "/api/hq/tasks", { title: "로고 시안 3개 보내기", venture_id: v.id, priority: "P0", due_date: key(today), checklist: ["시안 A", "시안 B"] }, 201)).task;
const t2 = (await call("POST", "/api/hq/tasks", { title: "간판 견적 받기", venture_id: v.id, priority: "P1", due_date: key(yesterday) }, 201)).task;
await call("POST", "/api/hq/tasks", { title: "사업 없는 할 일", priority: "P3" }, 201);
await call("POST", "/api/hq/tasks", { title: "잘못된 사업", venture_id: "nope" }, 404);
await call("POST", "/api/hq/tasks", { title: "" }, 400);

const list = await call("GET", "/api/hq/tasks?status=open");
if (list.tasks.length !== 3) { console.log("FAIL expected 3 open tasks"); failures++; }
if (list.tasks[0].id !== t2.id) { console.log("FAIL overdue task should sort first"); failures++; }
const filtered = await call("GET", `/api/hq/tasks?venture_id=${v.id}&priority=P0`);
if (filtered.tasks.length !== 1) { console.log("FAIL expected 1 P0 task in venture"); failures++; }
const searched = await call("GET", "/api/hq/tasks?q=시안");
if (searched.tasks.length !== 1) { console.log("FAIL search should match title/checklist"); failures++; }

const toggled = (await call("PATCH", `/api/hq/tasks/${t1.id}`, { checklist_toggle: t1.checklist[0].id })).task;
if (!toggled.checklist[0].done) { console.log("FAIL checklist toggle"); failures++; }
const added = (await call("PATCH", `/api/hq/tasks/${t1.id}`, { checklist_add: "시안 C" })).task;
if (added.checklist.length !== 3) { console.log("FAIL checklist add"); failures++; }
const doing = (await call("PATCH", `/api/hq/tasks/${t1.id}`, { status: "doing" })).task;
if (doing.status !== "doing" || doing.completed_at) { console.log("FAIL status doing"); failures++; }
const done = (await call("PATCH", `/api/hq/tasks/${t2.id}`, { status: "done" })).task;
if (done.status !== "done" || !done.completed_at) { console.log("FAIL status done sets completed_at"); failures++; }
await call("PATCH", `/api/hq/tasks/${t1.id}`, { due_date: "not-a-date" }, 400);
await call("PATCH", `/api/hq/tasks/${t1.id}`, { due_date: "2026-02-30" }, 400);
await call("PATCH", `/api/hq/tasks/${t1.id}`, { checklist_toggle: "missing" }, 404);

const c = (await call("POST", "/api/hq/comments", { target_type: "task", target_id: t1.id, body: "클라이언트가 A안 선호" }, 201)).comment;
await call("POST", "/api/hq/comments", { target_type: "task", target_id: "missing", body: "x" }, 404);
await call("POST", "/api/hq/comments", { target_type: "bogus", target_id: t1.id, body: "x" }, 400);
const cl = await call("GET", `/api/hq/comments?target_type=task&target_id=${t1.id}`);
if (cl.comments.length !== 1) { console.log("FAIL expected 1 comment"); failures++; }
await call("POST", `/api/hq/tasks/${t1.id}/advise`, undefined, [201, 503, 502, 429]);

const detail = await call("GET", `/api/hq/ventures/${v.id}`);
if (detail.tasks.length !== 2 || detail.venture.task_done !== 1) { console.log("FAIL venture detail stats"); failures++; }
await call("PATCH", `/api/hq/ventures/${v.id}`, { status: "paused", goal: "11월 오픈" });

const imp = await call("POST", "/api/hq/knowledge", {
  items: [
    { kind: "conversation", title: "카페 로고 대화", content: "### 나\n로고 만들자\n\n### Claude\n시안 3개", source_uuid: "conv-1", source_date: "2026-09-01T00:00:00Z" },
    { kind: "conversation", title: "중복", content: "dup", source_uuid: "conv-1" },
    { kind: "note", title: "", content: "메모 첫 줄\n본문" },
  ],
}, 201);
if (imp.items.length !== 2 || imp.skipped !== 1) { console.log("FAIL import dedupe"); failures++; }
await call("POST", "/api/hq/knowledge", { items: [] }, 400);
const k = imp.items[0];
const kd = await call("GET", `/api/hq/knowledge/${k.id}`);
if (!kd.item.content.includes("로고 만들자")) { console.log("FAIL knowledge content"); failures++; }
await call("PATCH", `/api/hq/knowledge/${k.id}`, { venture_id: v.id });
await call("POST", `/api/hq/knowledge/${k.id}/analyze`, {}, [200, 503, 502, 429]);
await call("POST", "/api/hq/comments", { target_type: "knowledge", target_id: k.id, body: "자료 코멘트" }, 201);

await call("GET", "/api/hq/secretary/messages");
await call("POST", "/api/hq/secretary/messages", { message: "오늘 뭐부터?" }, [201, 503, 502, 429]);
await call("POST", "/api/hq/secretary/messages", { message: "" }, 400);
await call("GET", "/api/hq/secretary/briefing");
await call("POST", "/api/hq/secretary/briefing", undefined, [201, 503, 502, 429]);
await call("POST", "/api/hq/secretary/proposals/accept", { message_id: "nope", index: 0 }, 404);

const ov = await call("GET", "/api/hq/overview");
// buckets are disjoint: the doing task due today lands in "today", not "doing"; the stat still counts it
if (ov.stats.open_tasks !== 2 || ov.stats.doing_tasks !== 1 || ov.stats.done_this_week !== 1 || ov.tasks.today.length !== 1 || ov.tasks.doing.length !== 0) {
  console.log("FAIL overview stats", JSON.stringify(ov.stats), ov.tasks.today.length, ov.tasks.doing.length); failures++;
}
if (ov.stats.knowledge_count !== 2) { console.log("FAIL knowledge count"); failures++; }

// search across everything
const sr = await call("GET", "/api/hq/search?q=" + encodeURIComponent("로고"));
if (!sr.hits.some((h) => h.kind === "knowledge") || !sr.hits.some((h) => h.kind === "task")) { console.log("FAIL search should find the task and knowledge item", JSON.stringify(sr.counts)); failures++; }
const sr2 = await call("GET", "/api/hq/search?q=" + encodeURIComponent("클라이언트 A안"));
if (!sr2.hits.some((h) => h.kind === "comment")) { console.log("FAIL search should find the comment"); failures++; }
const sr3 = await call("GET", "/api/hq/search?q=");
if (sr3.hits.length !== 0) { console.log("FAIL empty query returns nothing"); failures++; }

// venture review + weekly review (AI; 503 without a key)
await call("POST", `/api/hq/ventures/${v.id}/review`, undefined, [201, 503, 502, 429]);
await call("POST", "/api/hq/secretary/briefing", { kind: "weekly" }, [201, 503, 502, 429]);
await call("POST", "/api/hq/secretary/briefing", { kind: "monthly" }, 400);

// backup round-trip: export, wipe by restoring an empty backup, restore the export
const backupRes = await fetch(BASE + "/api/hq/backup", { headers: { cookie } });
const backup = await backupRes.json();
console.log(`${backupRes.status === 200 ? "ok " : "FAIL"} GET /api/hq/backup -> ${backupRes.status}`);
if (backupRes.status !== 200) failures++;
if (backup.format !== "rorop-hq-backup" || backup.data.tasks.length !== 3 || backup.data.knowledge.length !== 2) { console.log("FAIL backup contents", backup.format, backup.data?.tasks?.length); failures++; }
await call("POST", "/api/hq/backup", { backup, confirm: "no" }, 400);
await call("POST", "/api/hq/backup", { backup: { format: "other" }, confirm: "REPLACE" }, 400);
const empty = { ...backup, data: { ventures: [], tasks: [], comments: [], knowledge: [], secretary_messages: [], briefings: [] } };
await call("POST", "/api/hq/backup", { backup: empty, confirm: "REPLACE" });
const afterWipe = await call("GET", "/api/hq/tasks?status=all");
if (afterWipe.tasks.length !== 0) { console.log("FAIL restore(empty) should wipe tasks"); failures++; }
const restored = await call("POST", "/api/hq/backup", { backup, confirm: "REPLACE" });
if (restored.restored.tasks !== 3 || restored.restored.comments !== 2) { console.log("FAIL restore counts", JSON.stringify(restored.restored)); failures++; }
// ids are re-minted on restore; links must still hold together
const restoredVentures = (await call("GET", "/api/hq/ventures")).ventures;
const rv = restoredVentures.find((x) => x.name === "카페 브랜딩");
const restoredTasks = (await call("GET", "/api/hq/tasks?status=all")).tasks;
const rt = restoredTasks.find((x) => x.title === "로고 시안 3개 보내기");
if (!rv || !rt || rt.venture_id !== rv.id || rt.id === t1.id) { console.log("FAIL restore should re-link tasks to the restored venture with fresh ids"); failures++; }
const rtDetail = await call("GET", `/api/hq/tasks/${rt.id}`);
if (rtDetail.comments.length !== 1 || rtDetail.task.checklist.length !== 3) { console.log("FAIL restored task should keep its comment and checklist"); failures++; }
await call("GET", `/api/hq/tasks/${t1.id}`, undefined, 404);
// a malformed row is rejected before anything is replaced
const broken = { ...backup, data: { ...backup.data, tasks: [{ id: "x" }] } };
await call("POST", "/api/hq/backup", { backup: broken, confirm: "REPLACE" }, 400);
const stillThere = await call("GET", `/api/hq/tasks/${rt.id}`);
if (stillThere.task.title !== "로고 시안 3개 보내기") { console.log("FAIL rejected restore must not touch data"); failures++; }
// later steps refer to the restored ids
Object.assign(v, { id: rv.id }); Object.assign(t1, { id: rt.id });
const rt2 = restoredTasks.find((x) => x.title === "간판 견적 받기"); Object.assign(t2, { id: rt2.id });
const rk = (await call("GET", "/api/hq/knowledge")).items.find((x) => x.title === "카페 로고 대화"); Object.assign(k, { id: rk.id });
const rc = rtDetail.comments[0]; Object.assign(c, { id: rc.id });

// isolation: a second user must not see the first user's data
const savedCookie = cookie; cookie = "";
await call("POST", "/api/auth/register", { email: `other-${Date.now()}@example.com`, password: "secret123", name: "다른 사람", role: "client" });
await call("GET", `/api/hq/ventures/${v.id}`, undefined, 404);
await call("GET", `/api/hq/tasks/${t1.id}`, undefined, 404);
await call("DELETE", `/api/hq/comments/${c.id}`, undefined, 404);
const otherList = await call("GET", "/api/hq/tasks");
if (otherList.tasks.length !== 0) { console.log("FAIL isolation"); failures++; }
cookie = savedCookie;

await call("DELETE", `/api/hq/comments/${c.id}`);
await call("DELETE", `/api/hq/tasks/${t1.id}`);
await call("GET", `/api/hq/tasks/${t1.id}`, undefined, 404);
await call("DELETE", `/api/hq/ventures/${v.id}`);
const orphan = await call("GET", `/api/hq/tasks/${t2.id}`);
if (orphan.task.venture_id !== null) { console.log("FAIL venture delete should unlink tasks"); failures++; }
await call("DELETE", `/api/hq/knowledge/${k.id}`);
await call("DELETE", "/api/hq/secretary/messages");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL OK");
process.exit(failures ? 1 : 0);
