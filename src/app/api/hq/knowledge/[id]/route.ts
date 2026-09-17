import { NextRequest } from "next/server";
import { persist } from "@/lib/db";
import { handler, json, requireUser, readJson } from "@/lib/hq/api";
import { getKnowledge, knowledgeListItem, deleteKnowledge, getVenture, listComments, listTasks, sortTasks, withVenture } from "@/lib/hq/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const item = getKnowledge(user.id, id);
  const venture = item.venture_id ? getVenture(user.id, item.venture_id) : null;
  const tasks = sortTasks(listTasks(user.id).filter((t) => t.source_ref === id)).map((t) => withVenture(user.id, t));
  return json({ item, venture, tasks, comments: listComments(user.id, "knowledge", id) });
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const item = getKnowledge(user.id, id);
  const body = await readJson(req);
  if (body.venture_id !== undefined) {
    if (body.venture_id === null || body.venture_id === "") item.venture_id = null;
    else if (typeof body.venture_id === "string") {
      getVenture(user.id, body.venture_id);
      item.venture_id = body.venture_id;
    }
  }
  if (typeof body.title === "string" && body.title.trim()) item.title = body.title.trim();
  if (typeof body.summary === "string") item.summary = body.summary.trim();
  persist();
  return json({ item: knowledgeListItem(user.id, item) });
});

export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  deleteKnowledge(user.id, id);
  return json({ ok: true });
});
