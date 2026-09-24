import { NextRequest } from "next/server";
import { getStore, persist } from "@/lib/db";
import { handler, json, requireUser, readJson, newId, nowIso, requestToday, errorResponse, ApiError } from "@/lib/hq/api";
import { generateBriefing, generateWeeklyReview, SecretaryError } from "@/lib/hq/secretary";
import { buildSecretaryContext } from "@/lib/hq/service";
import type { Briefing, BriefingKind } from "@/lib/hq/types";

const kindOf = (b: Briefing): BriefingKind => b.kind || "daily";

function latestWeekly(userId: string): Briefing | null {
  return (
    getStore()
      .briefings.filter((b) => b.user_id === userId && kindOf(b) === "weekly")
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null
  );
}

/** GET — today's daily briefing, the latest weekly review, and recent history. */
export const GET = handler(async () => {
  const user = await requireUser();
  const today = await requestToday();
  const mine = getStore().briefings.filter((b) => b.user_id === user.id);
  const briefing = mine.find((b) => b.date === today && kindOf(b) === "daily") || null;
  const history = [...mine].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 14);
  return json({ briefing, weekly: latestWeekly(user.id), history });
});

/** POST { kind?: "daily" | "weekly" } — generate (or regenerate) today's briefing of that kind. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const today = await requestToday();
  const body = await readJson<{ kind?: unknown }>(req).catch(() => ({} as { kind?: unknown }));
  if (body.kind !== undefined && body.kind !== "daily" && body.kind !== "weekly") throw new ApiError(400, "kind는 daily 또는 weekly여야 합니다");
  const kind: BriefingKind = body.kind === "weekly" ? "weekly" : "daily";
  try {
    const context = buildSecretaryContext(user, today);
    const content = kind === "weekly" ? await generateWeeklyReview(context) : await generateBriefing(context);
    const store = getStore();
    let briefing = store.briefings.find((b) => b.user_id === user.id && b.date === today && kindOf(b) === kind);
    if (briefing) {
      briefing.content = content;
      briefing.created_at = nowIso();
    } else {
      briefing = { id: newId(), user_id: user.id, date: today, kind, content, created_at: nowIso() } satisfies Briefing;
      store.briefings.push(briefing);
    }
    persist();
    return json({ briefing }, 201);
  } catch (err) {
    if (err instanceof SecretaryError) return json({ error: err.message }, err.status);
    return errorResponse(err);
  }
});
