import { createHash } from "crypto";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
};

/** HTML 엔티티 디코드 (&amp; &#39; &#x27; 등) */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const num = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : m;
    }
    const key = code.toLowerCase();
    return key in ENTITIES ? ENTITIES[key] : m;
  });
}

/** HTML → 읽을 수 있는 평문. 블록 태그는 줄바꿈으로, 나머지는 제거 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|table|ul|ol|dd|dt|section|article)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/\r/g, "");
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/ *\n */g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** 다양한 표기의 날짜를 YYYY-MM-DD 로. 인식 불가 시 null */
export function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/(\d{4})\s*[-./년]?\s*(\d{1,2})\s*[-./월]?\s*(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "20240101 ~ 20240131", "2024.01.01~2024.01.31", "~ 예산 소진시까지" 등 */
export function parseDateRange(input: string | null | undefined): { start: string | null; end: string | null } {
  if (!input) return { start: null, end: null };
  const s = String(input);
  const parts = s.split(/~|∼|～|부터|-(?=\s*\d{4})/);
  if (parts.length >= 2) {
    return { start: parseDate(parts[0]), end: parseDate(parts.slice(1).join(" ")) };
  }
  const single = parseDate(s);
  return { start: null, end: single };
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 두 YYYY-MM-DD 사이의 일수 (b - a) */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** 매칭용 토큰화: 한글/영문/숫자 2자 이상 */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[가-힣a-z0-9+#.]{2,}/g) || []).map((t) => t.replace(/[.]+$/, ""));
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function sha1(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** 쉼표/공백/슬래시로 구분된 문자열을 배열로 */
export function splitList(input: string | null | undefined): string[] {
  if (!input) return [];
  return uniq(
    String(input)
      .split(/[,，/|·]|\s{2,}/)
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean)
  );
}

/** 객체에서 여러 후보 키 중 처음 존재하는 값을 문자열로 */
export function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}
