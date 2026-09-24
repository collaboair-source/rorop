import { NextRequest, NextResponse } from "next/server";
import { handler, json, requireUser, ApiError } from "@/lib/hq/api";
import { exportBackup, parseBackup, restoreBackup } from "@/lib/hq/service";

const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

/** GET /api/hq/backup — download every HQ record of the current user as one JSON file. */
export const GET = handler(async () => {
  const user = await requireUser();
  const backup = exportBackup(user);
  const filename = `rorop-hq-backup-${backup.exported_at.slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});

/** Read the request body as text, aborting as soon as it exceeds `max` bytes (Content-Length may be absent). */
async function readBodyCapped(req: NextRequest, max: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > max) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(413, "백업 파일이 너무 큽니다 (최대 64MB)");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** POST /api/hq/backup — restore: replaces ALL of this user's HQ data with the uploaded backup. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_BACKUP_BYTES) throw new ApiError(413, "백업 파일이 너무 큽니다 (최대 64MB)");
  const raw = await readBodyCapped(req, MAX_BACKUP_BYTES);
  let body: { backup?: unknown; confirm?: unknown };
  try {
    body = JSON.parse(raw) as { backup?: unknown; confirm?: unknown };
  } catch {
    throw new ApiError(400, "잘못된 JSON 본문입니다");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "요청 본문은 JSON 객체여야 합니다");
  if (body.confirm !== "REPLACE") throw new ApiError(400, "복원하려면 confirm: \"REPLACE\"를 보내야 합니다");
  const backup = parseBackup(body.backup);
  const summary = restoreBackup(user, backup);
  return json({ ok: true, restored: summary, exported_at: backup.exported_at });
});
