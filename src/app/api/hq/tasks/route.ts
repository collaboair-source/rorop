import { NextRequest } from "next/server";
import { handler, json, requireUser, readJson, requiredStr, optionalStr, strArray, parsePriority, parseDueDate, parseChecklist, parseTaskStatus } from "@/lib/hq/api";
import { listTasks, sortTasks, withVenture, createTask } from "@/lib/hq/service";
import { TASK_STATUSES } from "@/lib/hq/types";
import type { TaskStatus } from "@/lib/hq/types";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const ventureId = sp.get("venture_id");
  const priority = sp.get("priority");
  const q = (sp.get("q") || "").trim().toLowerCase();

  let tasks = listTasks(user.id);
  if (status && status !== "all") {
    if (status === "open") tasks = tasks.filter((t) => t.status !== "done");
    else if (TASK_STATUSES.includes(status as TaskStatus)) tasks = tasks.filter((t) => t.status === status);
  }
  if (ventureId) tasks = tasks.filter((t) => (ventureId === "none" ? !t.venture_id : t.venture_id === ventureId));
  if (priority) tasks = tasks.filter((t) => t.priority === priority);
  if (q) {
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.checklist.some((c) => c.text.toLowerCase().includes(q))
    );
  }
  return json({ tasks: sortTasks(tasks).map((t) => withVenture(user.id, t)) });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await readJson(req);
  const task = createTask(user.id, {
    title: requiredStr(body.title, "할 일 제목"),
    venture_id: typeof body.venture_id === "string" && body.venture_id ? body.venture_id : null,
    description: optionalStr(body.description),
    priority: parsePriority(body.priority),
    status: parseTaskStatus(body.status),
    due_date: parseDueDate(body.due_date),
    checklist: parseChecklist(body.checklist),
    tags: strArray(body.tags),
  });
  return json({ task: withVenture(user.id, task) }, 201);
});
