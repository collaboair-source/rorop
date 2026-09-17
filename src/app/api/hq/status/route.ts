import { handler, json, requireUser } from "@/lib/hq/api";
import { configHint, isAiConfigured, SECRETARY_MODEL } from "@/lib/hq/secretary";
import type { StatusResponse } from "@/lib/hq/types";

export const GET = handler(async () => {
  await requireUser();
  const body: StatusResponse = { ai_enabled: isAiConfigured(), model: SECRETARY_MODEL, hint: configHint() };
  return json(body);
});
