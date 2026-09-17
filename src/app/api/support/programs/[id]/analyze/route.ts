import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { getAnalysis, getProfile, getProgram, profileHash, saveAnalysis } from "@/lib/support/store";
import { scoreProgram } from "@/lib/support/matching";
import { analyzeProgram, analysisToMarkdown, isAiConfigured } from "@/lib/support/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** AI 적합도 분석 + 지원 가이드 생성. body: { force?: boolean } (프로필이 같고 force 가 아니면 캐시 반환) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const program = getProgram(decodeURIComponent(id));
  if (!program) return NextResponse.json({ error: "공고를 찾을 수 없습니다" }, { status: 404 });
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 가 설정되지 않아 AI 분석을 실행할 수 없습니다. .env 에 키를 추가하세요." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const profile = getProfile();
  const hash = profileHash(profile);
  const cached = getAnalysis(program.id);
  if (cached && cached.profile_hash === hash && !body.force) {
    return NextResponse.json({ analysis: cached, markdown: analysisToMarkdown(program, cached), cached: true });
  }

  const match = scoreProgram(program, profile);
  try {
    const analysis = await analyzeProgram(program, profile, match);
    saveAnalysis(analysis);
    return NextResponse.json({ analysis, markdown: analysisToMarkdown(program, analysis), cached: false });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Anthropic API 키가 올바르지 않습니다." }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "API 사용량 한도에 걸렸습니다. 잠시 후 다시 시도하세요." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Anthropic API 오류 (${err.status}): ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
