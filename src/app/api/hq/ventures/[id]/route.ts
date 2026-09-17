import { NextRequest } from "next/server";
import { persist } from "@/lib/db";
import { handler, json, requireUser, readJson, nowIso, strArray, parsePriority, parseVentureStatus, ApiError } from "@/lib/hq/api";
import { getVenture, ventureStats, deleteVenture, listTasks, sortTasks, withVenture, listComments, listKnowledge, knowledgeListItem } from "@/lib/hq/service";
import type { Venture } from "@/lib/hq/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const venture = getVenture(user.id, id);
  const tasks = sortTasks(listTasks(user.id).filter((t) => t.venture_id === id)).map((t) => withVenture(user.id, t));
  const comments = listComments(user.id, "venture", id);
  const knowledge = listKnowledge(user.id)
    .filter((k) => k.venture_id === id)
    .map((k) => knowledgeListItem(user.id, k));
  return json({ venture: ventureStats(user.id, venture), tasks, comments, knowledge });
});

export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const venture = getVenture(user.id, id);
  const body = await readJson(req);

  const patch: Partial<Venture> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) throw new ApiError(400, "사업 이름을 입력해주세요");
    patch.name = name;
  }
  if (typeof body.summary === "string") patch.summary = body.summary.trim();
  if (typeof body.goal === "string") patch.goal = body.goal.trim();
  if (body.status !== undefined) patch.status = parseVentureStatus(body.status, venture.status);
  if (body.priority !== undefined) patch.priority = parsePriority(body.priority, venture.priority);
  if (body.tags !== undefined) patch.tags = strArray(body.tags);
  Object.assign(venture, patch);
  venture.updated_at = nowIso();
  persist();
  return json({ venture: ventureStats(user.id, venture) });
});

export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  deleteVenture(user.id, id);
  return json({ ok: true });
});
