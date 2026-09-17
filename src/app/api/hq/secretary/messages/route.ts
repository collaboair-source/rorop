import { NextRequest } from "next/server";
import { getStore, persist } from "@/lib/db";
import { handler, json, requireUser, readJson, requiredStr, newId, nowIso, errorResponse, requestToday } from "@/lib/hq/api";
import { chatWithSecretary, SecretaryError } from "@/lib/hq/secretary";
import { buildSecretaryContext } from "@/lib/hq/service";
import type { SecretaryMessage } from "@/lib/hq/types";

const MAX_STORED_MESSAGES = 200;

function userMessages(userId: string): SecretaryMessage[] {
  return getStore()
    .secretary_messages.filter((m) => m.user_id === userId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const GET = handler(async () => {
  const user = await requireUser();
  return json({ messages: userMessages(user.id) });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await readJson(req);
  const text = requiredStr(body.message, "메시지");
  const store = getStore();
  const history = userMessages(user.id).map((m) => ({ role: m.role, content: m.content }));
  const today = await requestToday();

  try {
    const result = await chatWithSecretary({ context: buildSecretaryContext(user, today), history, message: text });
    const userMsg: SecretaryMessage = { id: newId(), user_id: user.id, role: "user", content: text, proposals: [], created_at: nowIso() };
    const reply: SecretaryMessage = {
      id: newId(),
      user_id: user.id,
      role: "secretary",
      content: result.reply,
      proposals: result.proposals,
      created_at: nowIso(),
    };
    store.secretary_messages.push(userMsg, reply);
    // keep the log bounded per user
    const mine = userMessages(user.id);
    if (mine.length > MAX_STORED_MESSAGES) {
      const drop = new Set(mine.slice(0, mine.length - MAX_STORED_MESSAGES).map((m) => m.id));
      store.secretary_messages = store.secretary_messages.filter((m) => !drop.has(m.id));
    }
    persist();
    return json({ user_message: userMsg, secretary_message: reply }, 201);
  } catch (err) {
    if (err instanceof SecretaryError) return json({ error: err.message }, err.status);
    return errorResponse(err);
  }
});

export const DELETE = handler(async () => {
  const user = await requireUser();
  const store = getStore();
  store.secretary_messages = store.secretary_messages.filter((m) => m.user_id !== user.id);
  persist();
  return json({ ok: true });
});
