// Run with: npm test  (Node 22 built-in test runner + type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClaudeExport, textToCandidate } from "../src/lib/hq/claude-export.ts";

const conversations = [
  {
    uuid: "c1",
    name: "카페 브랜딩 기획",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-02T10:00:00Z",
    chat_messages: [
      { uuid: "m2", sender: "assistant", text: "로고 시안 3개를 제안합니다.", created_at: "2026-09-01T10:01:00Z" },
      { uuid: "m1", sender: "human", text: "카페 로고 만들고 싶어", created_at: "2026-09-01T10:00:00Z", attachments: [{ file_name: "brief.txt", extracted_content: "브리프 내용" }] },
      { uuid: "m3", sender: "human", content: [{ type: "text", text: "블록 기반 메시지" }], created_at: "2026-09-01T10:02:00Z" },
    ],
  },
  { uuid: "c2", name: "빈 대화", chat_messages: [] },
  {
    uuid: "c3",
    name: "",
    created_at: "2026-09-10T10:00:00Z",
    chat_messages: [{ sender: "human", text: "제목 없는 첫 줄\n두번째 줄", created_at: "2026-09-10T10:00:00Z" }],
  },
];

test("parses conversations.json, orders messages, keeps attachments, skips empty", () => {
  const { candidates, detected, skipped } = parseClaudeExport(JSON.stringify(conversations));
  assert.equal(detected, "conversations");
  assert.equal(skipped, 1);
  assert.equal(candidates.length, 2);
  // newest first
  assert.equal(candidates[0].source_uuid, "c3");
  assert.equal(candidates[0].title, "제목 없는 첫 줄");
  const c1 = candidates[1];
  assert.equal(c1.title, "카페 브랜딩 기획");
  assert.equal(c1.message_count, 3);
  const firstIdx = c1.content.indexOf("카페 로고 만들고 싶어");
  const secondIdx = c1.content.indexOf("로고 시안 3개");
  assert.ok(firstIdx >= 0 && secondIdx > firstIdx, "human message should come before assistant reply");
  assert.ok(c1.content.includes("[첨부: brief.txt]"));
  assert.ok(c1.content.includes("블록 기반 메시지"));
  assert.ok(c1.preview.length <= 201);
});

test("parses projects.json with docs", () => {
  const projects = [
    { uuid: "p1", name: "쇼핑몰 리뉴얼", description: "설명", prompt_template: "지침", docs: [{ filename: "plan.md", content: "계획 본문" }], updated_at: "2026-09-05T00:00:00Z" },
    { uuid: "p2", name: "빈 프로젝트", docs: [] },
  ];
  const { candidates, detected, skipped } = parseClaudeExport(JSON.stringify(projects));
  assert.equal(detected, "projects");
  assert.equal(skipped, 1);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "project");
  assert.ok(candidates[0].content.includes("## 문서: plan.md"));
  assert.ok(candidates[0].content.includes("## 프로젝트 지침"));
});

test("accepts wrapper objects and single items", () => {
  const wrapped = { conversations: conversations.slice(0, 1), projects: [] };
  assert.equal(parseClaudeExport(JSON.stringify(wrapped)).candidates.length, 1);
  assert.equal(parseClaudeExport(JSON.stringify(conversations[0])).candidates.length, 1);
  const unknown = parseClaudeExport(JSON.stringify([{ foo: 1 }]));
  assert.equal(unknown.detected, "unknown");
  assert.equal(unknown.skipped, 1);
});

test("rejects invalid JSON with a Korean message", () => {
  assert.throws(() => parseClaudeExport("not json"), /JSON/);
});

test("textToCandidate builds a note", () => {
  assert.equal(textToCandidate("", "   "), null);
  const c = textToCandidate("", "첫 줄\n본문");
  assert.ok(c);
  assert.equal(c.kind, "note");
  assert.equal(c.title, "첫 줄");
});
