import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteProgram, getAnalysis, getProfile, getProgram, profileHash } from "@/lib/support/store";
import { scoreProgram } from "@/lib/support/matching";
import { analysisToMarkdown, currentModel, isAiConfigured } from "@/lib/support/ai";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const program = getProgram(decodeURIComponent(id));
  if (!program) return NextResponse.json({ error: "공고를 찾을 수 없습니다" }, { status: 404 });

  const profile = getProfile();
  const match = scoreProgram(program, profile);
  const analysis = getAnalysis(program.id);
  const hash = profileHash(profile);
  return NextResponse.json({
    program,
    match,
    analysis,
    markdown: analysis ? analysisToMarkdown(program, analysis) : null,
    analysis_stale: analysis ? analysis.profile_hash !== hash : false,
    ai: { configured: isAiConfigured(), model: currentModel() },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = deleteProgram(decodeURIComponent(id));
  if (!ok) return NextResponse.json({ error: "공고를 찾을 수 없습니다" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
