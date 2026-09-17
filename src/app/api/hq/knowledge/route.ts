import { NextRequest } from "next/server";
import { getStore, persist } from "@/lib/db";
import { handler, json, requireUser, readJson, newId, nowIso, ApiError } from "@/lib/hq/api";
import { listKnowledge, knowledgeListItem } from "@/lib/hq/service";
import type { KnowledgeItem, KnowledgeKind } from "@/lib/hq/types";

const KINDS: KnowledgeKind[] = ["conversation", "project", "note"];
const MAX_ITEMS_PER_REQUEST = 200;
const MAX_CONTENT_CHARS = 2_000_000;

export const GET = handler(async () => {
  const user = await requireUser();
  const items = listKnowledge(user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((k) => knowledgeListItem(user.id, k));
  return json({ items });
});

/** Bulk import. Body: { items: [{ kind, title, content, source_uuid?, source_date? }] } */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await readJson<{ items?: unknown }>(req);
  if (!Array.isArray(body.items) || body.items.length === 0) throw new ApiError(400, "가져올 항목이 없습니다");
  if (body.items.length > MAX_ITEMS_PER_REQUEST) throw new ApiError(400, `한 번에 최대 ${MAX_ITEMS_PER_REQUEST}개까지 가져올 수 있습니다`);

  // Validate the whole batch first so a rejected request leaves the store untouched.
  const existingUuids = new Set(listKnowledge(user.id).map((k) => k.source_uuid).filter(Boolean));
  const toCreate: KnowledgeItem[] = [];
  let skipped = 0;
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") { skipped++; continue; }
    const r = raw as Record<string, unknown>;
    const content = typeof r.content === "string" ? r.content.trim() : "";
    if (!content) { skipped++; continue; }
    if (content.length > MAX_CONTENT_CHARS) {
      const title = typeof r.title === "string" ? r.title : "";
      throw new ApiError(413, `자료가 너무 큽니다 (${title ? `「${title}」 ` : ""}${content.length.toLocaleString()}자, 최대 ${MAX_CONTENT_CHARS.toLocaleString()}자)`);
    }
    const source_uuid = typeof r.source_uuid === "string" && r.source_uuid ? r.source_uuid : null;
    if (source_uuid && existingUuids.has(source_uuid)) { skipped++; continue; }
    const kind = KINDS.includes(r.kind as KnowledgeKind) ? (r.kind as KnowledgeKind) : "note";
    toCreate.push({
      id: newId(),
      user_id: user.id,
      kind,
      title: (typeof r.title === "string" && r.title.trim()) || content.split("\n")[0].slice(0, 80) || "제목 없음",
      content,
      source_uuid,
      source_date: typeof r.source_date === "string" ? r.source_date : null,
      venture_id: null,
      summary: "",
      analyzed: false,
      analysis: null,
      created_at: nowIso(),
    });
    if (source_uuid) existingUuids.add(source_uuid);
  }
  const store = getStore();
  store.knowledge.push(...toCreate);
  const created = toCreate;
  persist();
  return json({ items: created.map((k) => knowledgeListItem(user.id, k)), skipped }, 201);
});
