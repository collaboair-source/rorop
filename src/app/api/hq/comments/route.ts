import { NextRequest } from "next/server";
import { handler, json, requireUser, readJson, requiredStr, ApiError } from "@/lib/hq/api";
import { listComments, addComment } from "@/lib/hq/service";
import type { CommentTarget } from "@/lib/hq/types";

const TARGETS: CommentTarget[] = ["venture", "task", "knowledge"];

function parseTarget(value: unknown): CommentTarget {
  if (!TARGETS.includes(value as CommentTarget)) throw new ApiError(400, "target_type은 venture, task, knowledge 중 하나여야 합니다");
  return value as CommentTarget;
}

export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const type = parseTarget(sp.get("target_type"));
  const id = sp.get("target_id") || "";
  if (!id) throw new ApiError(400, "target_id가 필요합니다");
  return json({ comments: listComments(user.id, type, id) });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await readJson(req);
  const type = parseTarget(body.target_type);
  const id = requiredStr(body.target_id, "target_id");
  const text = requiredStr(body.body, "코멘트 내용");
  const comment = addComment(user.id, type, id, "user", text);
  return json({ comment }, 201);
});
