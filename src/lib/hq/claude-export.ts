// Parsers for the Claude.ai data export (Settings → Privacy → Export data).
// The export ships `conversations.json` and `projects.json`. These functions are
// pure and dependency-free so they run in the browser (parsing large files
// client-side keeps upload requests small) and on the server.

import type { KnowledgeKind } from "./types";

export interface ImportCandidate {
  kind: KnowledgeKind;
  title: string;
  content: string;
  source_uuid: string | null;
  source_date: string | null;
  message_count: number;
  preview: string;
}

interface RawContentBlock {
  type?: string;
  text?: string;
}

interface RawAttachment {
  file_name?: string;
  file_type?: string;
  extracted_content?: string;
}

interface RawMessage {
  uuid?: string;
  text?: string;
  content?: RawContentBlock[];
  sender?: string;
  created_at?: string;
  attachments?: RawAttachment[];
  files?: { file_name?: string }[];
}

interface RawConversation {
  uuid?: string;
  name?: string;
  summary?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: RawMessage[];
}

interface RawProjectDoc {
  uuid?: string;
  filename?: string;
  content?: string;
  created_at?: string;
}

interface RawProject {
  uuid?: string;
  name?: string;
  description?: string;
  prompt_template?: string;
  created_at?: string;
  updated_at?: string;
  docs?: RawProjectDoc[];
}

const MAX_ATTACHMENT_CHARS = 6000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function messageText(m: RawMessage): string {
  if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
  if (Array.isArray(m.content)) {
    return m.content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => (b.text as string).trim())
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function attachmentText(m: RawMessage): string {
  const parts: string[] = [];
  for (const a of m.attachments || []) {
    if (!a) continue;
    const name = a.file_name || "첨부파일";
    const body = typeof a.extracted_content === "string" ? a.extracted_content.trim() : "";
    if (body) {
      const clipped = body.length > MAX_ATTACHMENT_CHARS ? `${body.slice(0, MAX_ATTACHMENT_CHARS)}\n…(첨부 내용 일부 생략)` : body;
      parts.push(`[첨부: ${name}]\n${clipped}`);
    } else {
      parts.push(`[첨부: ${name}]`);
    }
  }
  for (const f of m.files || []) {
    if (f && f.file_name) parts.push(`[파일: ${f.file_name}]`);
  }
  return parts.join("\n");
}

export function conversationToCandidate(c: RawConversation): ImportCandidate | null {
  const messages = Array.isArray(c.chat_messages) ? c.chat_messages : [];
  const sorted = [...messages].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return ta - tb;
  });
  const lines: string[] = [];
  for (const m of sorted) {
    const text = messageText(m);
    const attach = attachmentText(m);
    if (!text && !attach) continue;
    const who = m.sender === "human" ? "나" : m.sender === "assistant" ? "Claude" : (m.sender || "?");
    lines.push(`### ${who}\n${[text, attach].filter(Boolean).join("\n\n")}`);
  }
  const content = lines.join("\n\n");
  if (!content.trim()) return null;
  const title = (c.name || "").trim() || firstLine(content) || "제목 없는 대화";
  return {
    kind: "conversation",
    title,
    content,
    source_uuid: c.uuid || null,
    source_date: c.updated_at || c.created_at || null,
    message_count: lines.length,
    preview: preview(content),
  };
}

export function projectToCandidate(p: RawProject): ImportCandidate | null {
  const sections: string[] = [];
  if (p.description && p.description.trim()) sections.push(`## 설명\n${p.description.trim()}`);
  if (p.prompt_template && p.prompt_template.trim()) sections.push(`## 프로젝트 지침\n${p.prompt_template.trim()}`);
  const docs = Array.isArray(p.docs) ? p.docs : [];
  for (const d of docs) {
    if (!d) continue;
    const body = typeof d.content === "string" ? d.content.trim() : "";
    if (!body) continue;
    sections.push(`## 문서: ${d.filename || "문서"}\n${body}`);
  }
  const content = sections.join("\n\n");
  if (!content.trim()) return null;
  return {
    kind: "project",
    title: (p.name || "").trim() || "제목 없는 프로젝트",
    content,
    source_uuid: p.uuid || null,
    source_date: p.updated_at || p.created_at || null,
    message_count: docs.length,
    preview: preview(content),
  };
}

export function textToCandidate(title: string, text: string): ImportCandidate | null {
  const content = text.trim();
  if (!content) return null;
  return {
    kind: "note",
    title: title.trim() || firstLine(content) || "메모",
    content,
    source_uuid: null,
    source_date: null,
    message_count: 0,
    preview: preview(content),
  };
}

export interface ParseResult {
  candidates: ImportCandidate[];
  detected: "conversations" | "projects" | "mixed" | "unknown";
  skipped: number;
}

/**
 * Parse the JSON text of a Claude export file. Accepts `conversations.json`,
 * `projects.json`, a single conversation/project object, or a wrapper object
 * containing either list.
 */
export function parseClaudeExport(jsonText: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("JSON 파일을 해석할 수 없습니다. Claude 데이터 내보내기의 conversations.json 또는 projects.json 파일인지 확인하세요.");
  }

  let list: unknown[] = [];
  if (Array.isArray(data)) list = data;
  else if (isRecord(data)) {
    if (Array.isArray(data.conversations)) list = list.concat(data.conversations as unknown[]);
    if (Array.isArray(data.projects)) list = list.concat(data.projects as unknown[]);
    if (!list.length) list = [data];
  }

  const candidates: ImportCandidate[] = [];
  let conv = 0;
  let proj = 0;
  let skipped = 0;
  for (const item of list) {
    if (!isRecord(item)) { skipped++; continue; }
    if (Array.isArray(item.chat_messages)) {
      const c = conversationToCandidate(item as RawConversation);
      if (c) { candidates.push(c); conv++; } else skipped++;
    } else if (Array.isArray(item.docs) || typeof item.prompt_template === "string") {
      const p = projectToCandidate(item as RawProject);
      if (p) { candidates.push(p); proj++; } else skipped++;
    } else {
      skipped++;
    }
  }

  const detected = conv && proj ? "mixed" : conv ? "conversations" : proj ? "projects" : "unknown";
  // newest first
  candidates.sort((a, b) => (Date.parse(b.source_date || "") || 0) - (Date.parse(a.source_date || "") || 0));
  return { candidates, detected, skipped };
}

function firstLine(text: string): string {
  const line = text.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find((l) => l && l !== "나" && l !== "Claude");
  return line ? line.slice(0, 80) : "";
}

function preview(text: string): string {
  // Only look at a bounded prefix so the preview never retains a content-sized parent string.
  const flat = text.slice(0, 2000).replace(/###\s*(나|Claude)\n/g, "").replace(/\s+/g, " ").trim();
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
}
