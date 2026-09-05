/**
 * 단일 HTML 빌드용 라우터 — Next.js 의 next/navigation 을 대체한다.
 *
 * 게임은 /idol, /idol/new, /idol/play, /idol/album, /idol/endings 다섯 경로만 쓰고
 * router.push/replace 만 호출한다.
 * 여기서는 그 경로를 해시(#/idol/play)로 표현해 서버 없이 동작하게 한다.
 * 쿼리(#/idol/album?tab=ending)는 주소에 그대로 남겨 앨범 페이지가 읽을 수 있게 한다.
 * vite.config.mts 가 "next/navigation" import 를 이 파일로 치환한다.
 */

import { useSyncExternalStore } from "react";

export const ROUTES = ["/idol", "/idol/new", "/idol/play", "/idol/album", "/idol/endings"] as const;
export type Route = (typeof ROUTES)[number];

const DEFAULT_ROUTE: Route = "/idol";

function normalize(value: string): Route {
  const raw = value.replace(/^#/, "").split("?")[0];
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return (ROUTES as readonly string[]).includes(trimmed) ? (trimmed as Route) : DEFAULT_ROUTE;
}

let current: Route = DEFAULT_ROUTE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function syncFromLocation(): void {
  const next = normalize(window.location.hash);
  if (next !== current) {
    current = next;
    emit();
  }
}

if (typeof window !== "undefined") {
  current = normalize(window.location.hash);
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("popstate", syncFromLocation);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Route {
  return current;
}

/** 현재 경로 (main.tsx 가 렌더할 페이지를 고를 때 쓴다) */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function navigate(path: string, replace: boolean): void {
  const target = normalize(path);
  // 쿼리는 해시에 그대로 남긴다 (앨범의 ?tab=ending 등)
  const raw = path.replace(/^#/, "");
  const query = raw.includes("?") ? `?${raw.split("?").slice(1).join("?")}` : "";
  const url = `${window.location.pathname}${window.location.search}#${target}${query}`;
  try {
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  } catch {
    // 히스토리 조작이 막힌 환경(샌드박스 등)에서는 해시만 바꾼다 — hashchange 로 동기화된다.
    window.location.hash = target;
  }
  if (current !== target) {
    current = target;
    emit();
  }
  window.scrollTo(0, 0);
}

/** next/navigation 의 useRouter 대체. 참조가 고정되어야 useCallback/useEffect 의존성에 안전하다. */
const router = {
  push: (path: string) => navigate(path, false),
  replace: (path: string) => navigate(path, true),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => syncFromLocation(),
  prefetch: () => {},
};

export type AppRouter = typeof router;

export function useRouter(): AppRouter {
  return router;
}

export function usePathname(): Route {
  return useRoute();
}
