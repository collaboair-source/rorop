// 크롤러 공용 HTTP 유틸. 타임아웃 + 한국어 Accept-Language + 브라우저형 UA.

export type FetchLike = typeof fetch;

export interface HttpOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: FetchLike;
}

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
  Accept: "text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
};

export async function fetchText(url: string, opts: HttpOptions = {}): Promise<string> {
  const fetchImpl = opts.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      headers: { ...DEFAULT_HEADERS, ...(opts.headers || {}) },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} (${url})`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const text = await fetchText(url, { ...opts, headers: { Accept: "application/json", ...(opts.headers || {}) } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON 파싱 실패 (${url}): ${text.slice(0, 200)}`);
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
