import { getStore, persist } from "@/lib/db";
import { handler, json, requireUser, newId, nowIso, requestToday, errorResponse } from "@/lib/hq/api";
import { generateBriefing, SecretaryError } from "@/lib/hq/secretary";
import { buildSecretaryContext } from "@/lib/hq/service";
import type { Briefing } from "@/lib/hq/types";

export const GET = handler(async () => {
  const user = await requireUser();
  const today = await requestToday();
  const briefing = getStore().briefings.find((b) => b.user_id === user.id && b.date === today) || null;
  const history = getStore()
    .briefings.filter((b) => b.user_id === user.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
  return json({ briefing, history });
});

/** Generate (or regenerate) today's briefing. */
export const POST = handler(async () => {
  const user = await requireUser();
  const today = await requestToday();
  try {
    const content = await generateBriefing(buildSecretaryContext(user, today));
    const store = getStore();
    let briefing = store.briefings.find((b) => b.user_id === user.id && b.date === today);
    if (briefing) {
      briefing.content = content;
      briefing.created_at = nowIso();
    } else {
      briefing = { id: newId(), user_id: user.id, date: today, content, created_at: nowIso() } satisfies Briefing;
      store.briefings.push(briefing);
    }
    persist();
    return json({ briefing }, 201);
  } catch (err) {
    if (err instanceof SecretaryError) return json({ error: err.message }, err.status);
    return errorResponse(err);
  }
});
