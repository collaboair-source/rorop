import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getStore } from "./db";

let warnedAboutSecret = false;

/**
 * Session-signing secret. Resolved lazily (not at module load) so `next build`
 * succeeds without it; in production a missing/short secret fails the first
 * request loudly instead of silently signing with a public default.
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set (16+ characters) in production. See .env.example.");
  }
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn("[auth] JWT_SECRET is not set (or is shorter than 16 characters); using the development default.");
  }
  return secret || "dev-secret-change-in-production";
}

export function signToken(payload: { id: string; email: string; role: string }) {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  const secret = getSecret();
  try {
    return jwt.verify(token, secret) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const store = getStore();
  return store.users.find((u) => u.id === payload.id) || null;
}
