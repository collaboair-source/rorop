import { NextRequest } from "next/server";
import { handler, json, requireUser, errorResponse, requestToday } from "@/lib/hq/api";
import { adviseOnTask, SecretaryError } from "@/lib/hq/secretary";
import { getTask, getVenture, listComments, addComment, buildSecretaryContext } from "@/lib/hq/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const task = getTask(user.id, id);
  const venture = task.venture_id ? getVenture(user.id, task.venture_id) : null;
  const today = await requestToday();
  try {
    const advice = await adviseOnTask({
      context: buildSecretaryContext(user, today),
      task,
      venture,
      comments: listComments(user.id, "task", id),
    });
    const comment = addComment(user.id, "task", id, "secretary", advice);
    return json({ comment }, 201);
  } catch (err) {
    if (err instanceof SecretaryError) return json({ error: err.message }, err.status);
    return errorResponse(err);
  }
});
