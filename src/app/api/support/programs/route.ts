import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryPrograms, type ListQuery } from "@/lib/support/service";
import { buildProgram } from "@/lib/support/normalize";
import { saveProgram } from "@/lib/support/store";
import { parseDate, sha1 } from "@/lib/support/text";
import type { ProgramSource, ProgramStatus } from "@/lib/support/types";

export const dynamic = "force-dynamic";

/** 공고 검색/목록. ?q=&source=&status=&minScore=&sort=&onlyNew=1&onlyAnalyzed=1&limit=&offset= */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const query: ListQuery = {
    q: sp.get("q") || undefined,
    source: (sp.get("source") as ProgramSource | "all" | null) || "all",
    status: (sp.get("status") as ProgramStatus | "active" | "all" | null) || "active",
    minScore: sp.get("minScore") ? Number(sp.get("minScore")) : undefined,
    sort: (sp.get("sort") as ListQuery["sort"]) || "score",
    onlyNew: sp.get("onlyNew") === "1",
    onlyAnalyzed: sp.get("onlyAnalyzed") === "1",
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
  };
  return NextResponse.json(queryPrograms(query));
}

/** 크롤러가 놓친 공고를 직접 추가 (URL/공고문 붙여넣기) */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "공고명을 입력하세요" }, { status: 400 });
  const url = String(body.url || "").trim();
  const externalId = sha1(url || title).slice(0, 12);

  const program = buildProgram({
    source: "manual",
    external_id: externalId,
    title,
    url,
    summary: String(body.summary || ""),
    category: String(body.category || ""),
    target: String(body.target || ""),
    exclusion: String(body.exclusion || ""),
    region: String(body.region || ""),
    organization: String(body.organization || ""),
    apply_start: parseDate(body.apply_start),
    apply_end: parseDate(body.apply_end),
    apply_method: String(body.apply_method || ""),
    contact: String(body.contact || ""),
  });
  saveProgram(program);
  return NextResponse.json({ program }, { status: 201 });
}
