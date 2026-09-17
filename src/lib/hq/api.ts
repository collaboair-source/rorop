// Helpers shared by the HQ API routes that depend on the Next.js runtime.
// Pure validation helpers live in ./validate and are re-exported here.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import type { User } from "@/lib/db";
import { ApiError, TZ_COOKIE, todayKey, isValidTimeZone } from "./validate";

export * from "./validate";

export function json<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[hq api]", err);
  const message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Resolve the logged-in user or throw a 401 ApiError. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "로그인이 필요합니다");
  return user;
}

/** Wrap a route handler so thrown ApiErrors become JSON responses. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    throw new ApiError(400, "잘못된 JSON 본문입니다");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(400, "요청 본문은 JSON 객체여야 합니다");
  }
  return parsed as T;
}

/** The requesting user's time zone from the hq_tz cookie (falls back to TZ env / server local). */
export async function requestTimeZone(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TZ_COOKIE)?.value;
  if (!raw) return undefined;
  let tz: string;
  try {
    tz = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  return isValidTimeZone(tz) ? tz : undefined;
}

/** Today's date key for the requesting user. */
export async function requestToday(): Promise<string> {
  return todayKey(await requestTimeZone());
}
