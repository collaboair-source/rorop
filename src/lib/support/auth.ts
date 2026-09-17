import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export type Authz = { ok: true; via: "user" | "cron"; userId?: string } | { ok: false };

/**
 * 크롤링 트리거 인증:
 *  - 로그인 사용자 (쿠키)  또는
 *  - Authorization: Bearer <CRON_SECRET> / x-cron-secret 헤더 (Vercel Cron, 외부 스케줄러)
 */
export async function authorizeCrawl(req: NextRequest): Promise<Authz> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    const header = req.headers.get("x-cron-secret") || "";
    if (auth === `Bearer ${secret}` || header === secret) return { ok: true, via: "cron" };
  }
  const user = await getCurrentUser();
  if (user) return { ok: true, via: "user", userId: user.id };
  return { ok: false };
}
