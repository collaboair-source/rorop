import { NextRequest } from "next/server";
import { persist } from "@/lib/db";
import { handler, json, requireUser, readJson, nowIso, newId, strArray, parsePriority, parseDueDate, parseChecklist, parseTaskStatus, ApiError } from "@/lib/hq/api";
import { getTask, withVenture, deleteTask, getVenture, listComments } from "@/lib/hq/service";
import type { Task } from "@/lib/hq/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const task = getTask(user.id, id);
  const venture = task.venture_id ? getVenture(user.id, task.venture_id) : null;
  return json({ task: withVenture(user.id, task), venture, comments: listComments(user.id, "task", id) });
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const task = getTask(user.id, id);
  const body = await readJson(req);

  // Validate everything into a patch first so a rejected request changes nothing.
  const patch: Partial<Task> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) throw new ApiError(400, "할 일 제목을 입력해주세요");
    patch.title = title;
  }
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (body.venture_id !== undefined) {
    if (body.venture_id === null || body.venture_id === "") patch.venture_id = null;
    else if (typeof body.venture_id === "string") {
      getVenture(user.id, body.venture_id);
      patch.venture_id = body.venture_id;
    } else throw new ApiError(400, "venture_id 형식이 잘못되었습니다");
  }
  if (body.priority !== undefined) patch.priority = parsePriority(body.priority, task.priority);
  if (body.due_date !== undefined) patch.due_date = parseDueDate(body.due_date);
  if (body.tags !== undefined) patch.tags = strArray(body.tags);
  if (body.status !== undefined) {
    const next = parseTaskStatus(body.status, task.status);
    if (next !== task.status) {
      patch.status = next;
      patch.completed_at = next === "done" ? nowIso() : null;
    }
  }
  let checklist = body.checklist !== undefined ? parseChecklist(body.checklist) : task.checklist.map((c) => ({ ...c }));
  if (typeof body.checklist_add === "string" && body.checklist_add.trim()) {
    checklist.push({ id: newId(), text: body.checklist_add.trim(), done: false });
  }
  if (typeof body.checklist_toggle === "string") {
    const item = checklist.find((c) => c.id === body.checklist_toggle);
    if (!item) throw new ApiError(404, "체크리스트 항목을 찾을 수 없습니다");
    item.done = !item.done;
  }
  if (typeof body.checklist_remove === "string") {
    checklist = checklist.filter((c) => c.id !== body.checklist_remove);
  }
  patch.checklist = checklist;

  Object.assign(task, patch);
  task.updated_at = nowIso();
  persist();
  return json({ task: withVenture(user.id, task) });
});

export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  deleteTask(user.id, id);
  return json({ ok: true });
});
