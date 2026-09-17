import type { ProgramSource, SupportProgram } from "./types";
import { sha1, stripHtml } from "./text";

export type ProgramInput = Partial<SupportProgram> & {
  source: ProgramSource;
  external_id: string;
  title: string;
};

/** 부분 정보로 SupportProgram 을 만들고 id / content_hash 를 채운다 */
export function buildProgram(input: ProgramInput): SupportProgram {
  const now = new Date().toISOString();
  const p: SupportProgram = {
    id: `${input.source}:${input.external_id}`,
    source: input.source,
    external_id: input.external_id,
    title: clean(input.title),
    summary: clean(input.summary),
    category: clean(input.category),
    subcategory: clean(input.subcategory),
    target: clean(input.target),
    target_detail: clean(input.target_detail),
    exclusion: clean(input.exclusion),
    region: clean(input.region),
    business_age: clean(input.business_age),
    target_age: clean(input.target_age),
    organization: clean(input.organization),
    executing_org: clean(input.executing_org),
    department: clean(input.department),
    apply_start: input.apply_start ?? null,
    apply_end: input.apply_end ?? null,
    apply_method: clean(input.apply_method),
    contact: clean(input.contact),
    url: (input.url || "").trim(),
    hashtags: input.hashtags || [],
    attachments: input.attachments || [],
    posted_at: input.posted_at ?? null,
    first_seen_at: input.first_seen_at || now,
    last_seen_at: input.last_seen_at || now,
    updated_at: input.updated_at || now,
    content_hash: "",
  };
  p.content_hash = contentHash(p);
  return p;
}

/** 공고 본문이 바뀌었는지 판단하기 위한 해시 (메타 시각 제외) */
export function contentHash(p: SupportProgram): string {
  const fields = [
    p.title,
    p.summary,
    p.category,
    p.subcategory,
    p.target,
    p.target_detail,
    p.exclusion,
    p.region,
    p.business_age,
    p.target_age,
    p.organization,
    p.executing_org,
    p.apply_start || "",
    p.apply_end || "",
    p.apply_method,
    p.contact,
    p.url,
    p.hashtags.join(","),
  ];
  return sha1(fields.join(""));
}

/** 기존 공고에 상세 정보를 덧입힐 때: 비어 있는 필드만 채운다 */
export function mergeDetail(base: SupportProgram, detail: Partial<SupportProgram>): SupportProgram {
  const merged: SupportProgram = { ...base };
  for (const [k, v] of Object.entries(detail)) {
    if (v === undefined || v === null || v === "") continue;
    const key = k as keyof SupportProgram;
    const current = merged[key];
    if (Array.isArray(v)) {
      if (!Array.isArray(current) || current.length === 0) (merged as unknown as Record<string, unknown>)[key] = v;
    } else if (current === "" || current === null || current === undefined) {
      (merged as unknown as Record<string, unknown>)[key] = v;
    } else if (key === "summary" && typeof v === "string" && v.length > String(current).length) {
      merged.summary = v;
    }
  }
  merged.content_hash = contentHash(merged);
  return merged;
}

function clean(v: unknown): string {
  if (v === undefined || v === null) return "";
  return stripHtml(String(v));
}

/** 본문 평문에서 "사업개요", "지원대상" 같은 라벨 뒤의 문단을 뽑는다 */
export function extractLabeledSections(text: string, labels: string[], maxLen = 2000): Record<string, string> {
  const result: Record<string, string> = {};
  const escaped = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const labelRe = new RegExp(`(?:^|\\n)\\s*[\\[【(]?\\s*(${escaped.join("|")})\\s*[\\]】)]?\\s*[:：]?\\s*`, "g");
  const matches: { label: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(text)) !== null) {
    matches.push({ label: m[1], start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const body = text.slice(cur.end, next ? next.start : text.length).trim();
    if (!body) continue;
    if (!result[cur.label] || result[cur.label].length < body.length) {
      result[cur.label] = body.slice(0, maxLen);
    }
  }
  return result;
}
