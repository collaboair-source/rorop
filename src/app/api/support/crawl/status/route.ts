import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCrawlLogs, storeInfo } from "@/lib/support/store";
import { currentModel, isAiConfigured } from "@/lib/support/ai";

export const dynamic = "force-dynamic";

/** 최근 크롤링 로그 + 설정 상태 (어떤 키가 잡혀 있는지) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    logs: listCrawlLogs().slice(0, 10),
    store: storeInfo(),
    config: {
      bizinfo_api_key: Boolean(process.env.BIZINFO_API_KEY),
      data_go_kr_service_key: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
      anthropic: isAiConfigured(),
      model: currentModel(),
      webhook: Boolean(process.env.NOTIFY_WEBHOOK_URL),
      cron_secret: Boolean(process.env.CRON_SECRET),
      auto_analyze_top_n: Number(process.env.SUPPORT_AI_AUTO_ANALYZE_TOP_N || 0),
    },
  });
}
