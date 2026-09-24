// Pure text-search helpers (no Next/alias imports so they are unit-testable under Node).

export function normalizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 8);
}

/** Strip transcript/markdown markers so snippets read as plain text. */
export function plainText(text: string): string {
  return text
    .replace(/^#{1,6}\s*(나|Claude)\s*$/gm, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "");
}

/** Excerpt around the first token occurrence (plain text, ~140 chars). */
export function snippetAround(text: string, tokens: string[], width = 140): string {
  const flat = plainText(text).replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const lower = flat.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return flat.length > width ? `${flat.slice(0, width)}…` : flat;
  const start = Math.max(0, idx - Math.floor(width / 3));
  const end = Math.min(flat.length, start + width);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/** Longest slice of a text field that is scanned (keeps a search bounded on huge imports). */
export const MAX_SCAN_CHARS = 200_000;

/** Score = sum over tokens of the best field weight; 0 when any token is missing everywhere. */
export function scoreFields(tokens: string[], fields: { text: string; weight: number }[]): number {
  // Lower-case each field once, not once per token.
  const lowered = fields.filter((f) => f.text).map((f) => ({ text: f.text.slice(0, MAX_SCAN_CHARS).toLowerCase(), weight: f.weight }));
  let total = 0;
  for (const raw of tokens) {
    const t = raw.toLowerCase();
    let best = 0;
    for (const f of lowered) {
      if (f.weight > best && f.text.includes(t)) best = f.weight;
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}
