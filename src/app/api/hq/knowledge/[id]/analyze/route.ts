import { NextRequest } from "next/server";
import { persist } from "@/lib/db";
import { handler, json, requireUser, readJson, nowIso, toValidDate, errorResponse, requestToday } from "@/lib/hq/api";
import { analyzeKnowledge, SecretaryError } from "@/lib/hq/secretary";
import { getKnowledge, listVentures, listTasks, getVenture, createVenture, findVentureByName, createTask, addComment, withVenture, knowledgeListItem } from "@/lib/hq/service";
import { PRIORITIES } from "@/lib/hq/types";
import type { Task, Venture } from "@/lib/hq/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Run the AI analysis on a knowledge item: summarize, link/create the venture,
 * create tasks (unless create_tasks=false) and leave a secretary comment.
 */
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const item = getKnowledge(user.id, id);
  type Options = { create_tasks?: boolean; create_venture?: boolean };
  const body: Options = await readJson<Options>(req).catch(() => ({} as Options));
  const createTasks = body.create_tasks !== false;
  const createVentureAllowed = body.create_venture !== false;
  const today = await requestToday();

  try {
    const result = await analyzeKnowledge({
      userName: user.name,
      today,
      title: item.title,
      kind: item.kind,
      content: item.content,
      ventures: listVentures(user.id),
    });

    // Resolve the venture: explicit match → name match → create.
    let venture: Venture | null = null;
    if (result.venture.match_existing_id) {
      try { venture = getVenture(user.id, result.venture.match_existing_id); } catch { venture = null; }
    }
    if (!venture) venture = findVentureByName(user.id, result.venture.name) || null;
    if (!venture && createVentureAllowed && result.venture.name.trim()) {
      venture = createVenture(user.id, {
        name: result.venture.name,
        summary: result.venture.summary,
        status: "active",
        priority: "P2",
        source: "claude",
        source_ref: item.id,
      });
    }
    if (venture && !venture.summary && result.venture.summary) {
      venture.summary = result.venture.summary;
      venture.updated_at = nowIso();
    }

    const tasks: Task[] = [];
    let skippedDuplicates = 0;
    if (createTasks) {
      // Re-analysis must not duplicate tasks already derived from this item (or open ones in the venture).
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
      const existing = new Set(
        listTasks(user.id)
          .filter((t) => t.source_ref === item.id || (venture && t.venture_id === venture.id && t.status !== "done"))
          .map((t) => normalize(t.title))
      );
      for (const t of result.tasks.slice(0, 12)) {
        const title = t.title.trim();
        if (!title) continue;
        if (existing.has(normalize(title))) {
          skippedDuplicates++;
          continue;
        }
        existing.add(normalize(title));
        tasks.push(
          createTask(user.id, {
            title,
            description: t.description,
            priority: PRIORITIES.includes(t.priority) ? t.priority : "P2",
            due_date: toValidDate(t.due_date),
            venture_id: venture ? venture.id : null,
            source: "claude",
            source_ref: item.id,
          })
        );
      }
    }

    item.summary = result.summary;
    item.analyzed = true;
    item.venture_id = venture ? venture.id : item.venture_id;
    item.analysis = {
      summary: result.summary,
      venture: { name: result.venture.name, summary: result.venture.summary, match_existing_id: venture ? venture.id : null },
      tasks: result.tasks,
      insights: result.insights,
      analyzed_at: nowIso(),
    };
    persist();

    const noteLines = [
      `**분석 완료** — ${venture ? `사업 「${venture.name}」에 연결` : "사업 미지정"}${tasks.length ? `, 할 일 ${tasks.length}개 등록` : ""}${skippedDuplicates ? ` (이미 있는 할 일 ${skippedDuplicates}개 건너뜀)` : ""}.`,
      result.truncated ? "\n⚠️ 자료가 길어 앞부분만 분석했습니다." : "",
      result.insights.length ? `\n\n**비서의 관찰**\n${result.insights.map((i) => `- ${i}`).join("\n")}` : "",
    ];
    const comment = addComment(user.id, "knowledge", item.id, "secretary", noteLines.join(""));

    return json({
      item: knowledgeListItem(user.id, item),
      analysis: item.analysis,
      venture,
      tasks: tasks.map((t) => withVenture(user.id, t)),
      comment,
      truncated: result.truncated,
      skipped_duplicates: skippedDuplicates,
    });
  } catch (err) {
    if (err instanceof SecretaryError) return json({ error: err.message }, err.status);
    return errorResponse(err);
  }
});
