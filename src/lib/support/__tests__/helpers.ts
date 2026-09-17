import type { FetchLike } from "../http";

export type Route = string | ((url: string) => string | { status: number; body: string });

/** URL 부분 문자열 → 응답 본문 매핑으로 fetch 를 흉내낸다 */
export function mockFetch(routes: Record<string, Route>, calls: string[] = []): FetchLike {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    for (const [needle, route] of Object.entries(routes)) {
      if (!url.includes(needle)) continue;
      const r = typeof route === "function" ? route(url) : route;
      if (typeof r === "string") return new Response(r, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
      return new Response(r.body, { status: r.status });
    }
    return new Response("not found", { status: 404, statusText: "Not Found" });
  }) as FetchLike;
}
