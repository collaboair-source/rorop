import { NextRequest, NextResponse } from "next/server";
import { authorizeCrawl } from "@/lib/support/auth";
import { runCrawl } from "@/lib/support/crawlers";
import type { ProgramSource } from "@/lib/support/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 크롤링 실행.
 *  - GET  : Vercel Cron 등 스케줄러용 (Authorization: Bearer CRON_SECRET 필수)
 *  - POST : 화면의 "지금 크롤링" 버튼 (로그인) 또는 스케줄러. body: { sources?, analyzeTopN?, notify? }
 */
export async function GET(req: NextRequest) {
  const authz = await authorizeCrawl(req);
  if (!authz.ok || authz.via !== "cron") {
    return NextResponse.json({ error: "Unauthorized (스케줄 실행은 CRON_SECRET 이 필요합니다)" }, { status: 401 });
  }
  const result = await runCrawl({ trigger: "cron" });
  return NextResponse.json(summarize(result));
}

export async function POST(req: NextRequest) {
  const authz = await authorizeCrawl(req);
  if (!authz.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sources = Array.isArray(body.sources) ? (body.sources as ProgramSource[]) : undefined;
  const result = await runCrawl({
    trigger: authz.via === "cron" ? "cron" : "manual",
    sources,
    analyzeTopN: typeof body.analyzeTopN === "number" ? body.analyzeTopN : undefined,
    notify: typeof body.notify === "boolean" ? body.notify : undefined,
  });
  return NextResponse.json(summarize(result));
}

function summarize(result: Awaited<ReturnType<typeof runCrawl>>) {
  const { digest_items, ...log } = result;
  return {
    ...log,
    top_new: digest_items.map((d) => ({ id: d.program.id, title: d.program.title, score: d.match.score, apply_end: d.program.apply_end })),
  };
}
