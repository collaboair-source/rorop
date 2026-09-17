import { NextRequest } from "next/server";
import { handler, json, requireUser, readJson, requiredStr, optionalStr, strArray, parsePriority, parseVentureStatus } from "@/lib/hq/api";
import { listVentures, ventureStats, createVenture } from "@/lib/hq/service";

export const GET = handler(async () => {
  const user = await requireUser();
  const ventures = listVentures(user.id)
    .map((v) => ventureStats(user.id, v))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return json({ ventures });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await readJson(req);
  const venture = createVenture(user.id, {
    name: requiredStr(body.name, "사업 이름"),
    summary: optionalStr(body.summary),
    goal: optionalStr(body.goal),
    status: parseVentureStatus(body.status),
    priority: parsePriority(body.priority),
    tags: strArray(body.tags),
  });
  return json({ venture: ventureStats(user.id, venture) }, 201);
});
