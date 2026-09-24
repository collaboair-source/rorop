import { NextRequest } from "next/server";
import { handler, json, requireUser } from "@/lib/hq/api";
import { searchAll } from "@/lib/hq/service";

/** GET /api/hq/search?q=... — searches ventures, tasks, knowledge and comments. */
export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 200);
  return json(searchAll(user.id, q));
});
