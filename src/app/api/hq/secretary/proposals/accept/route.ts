import { NextRequest } from "next/server";
import { getStore, persist } from "@/lib/db";
import { handler, json, requireUser, readJson, requiredStr, ApiError, toValidDate } from "@/lib/hq/api";
import { PRIORITIES } from "@/lib/hq/types";
import { createTask, createVenture, findVentureByName, withVenture } from "@/lib/hq/service";

/** Body: { message_id, index } — turns a secretary proposal into a real task. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await readJson(req);
  const messageId = requiredStr(body.message_id, "message_id");
  const index = body.index;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) throw new ApiError(400, "index는 0 이상의 정수여야 합니다");
  const message = getStore().secretary_messages.find((m) => m.id === messageId && m.user_id === user.id);
  if (!message) throw new ApiError(404, "메시지를 찾을 수 없습니다");
  const proposal = message.proposals[index];
  if (!proposal) throw new ApiError(404, "제안을 찾을 수 없습니다");
  if (!proposal.title || !proposal.title.trim()) throw new ApiError(400, "제안에 제목이 없어 등록할 수 없습니다");
  if (proposal.accepted && proposal.task_id) {
    const existing = getStore().tasks.find((t) => t.id === proposal.task_id);
    if (existing) return json({ task: withVenture(user.id, existing), proposal });
  }

  let ventureId = proposal.venture_id;
  if (!ventureId && proposal.venture_name) {
    const found = findVentureByName(user.id, proposal.venture_name);
    ventureId = found ? found.id : createVenture(user.id, { name: proposal.venture_name, source: "secretary", source_ref: message.id }).id;
  }
  if (ventureId && !getStore().ventures.some((v) => v.id === ventureId && v.user_id === user.id)) ventureId = null;

  const task = createTask(user.id, {
    title: proposal.title.trim(),
    description: proposal.description || "",
    priority: PRIORITIES.includes(proposal.priority) ? proposal.priority : "P2",
    due_date: toValidDate(proposal.due_date),
    venture_id: ventureId,
    source: "secretary",
    source_ref: message.id,
  });
  proposal.accepted = true;
  proposal.task_id = task.id;
  if (ventureId) {
    proposal.venture_id = ventureId;
    proposal.venture_name = getStore().ventures.find((v) => v.id === ventureId)?.name || proposal.venture_name;
  }
  persist();
  return json({ task: withVenture(user.id, task), proposal }, 201);
});
