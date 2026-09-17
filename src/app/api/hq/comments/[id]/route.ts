import { NextRequest } from "next/server";
import { getStore, persist } from "@/lib/db";
import { handler, json, requireUser, ApiError } from "@/lib/hq/api";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const store = getStore();
  const idx = store.comments.findIndex((c) => c.id === id && c.user_id === user.id);
  if (idx === -1) throw new ApiError(404, "코멘트를 찾을 수 없습니다");
  store.comments.splice(idx, 1);
  persist();
  return json({ ok: true });
});
