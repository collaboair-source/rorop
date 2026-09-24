import { NextRequest } from "next/server";
import { handler, json, requireUser, errorResponse, requestToday } from "@/lib/hq/api";
import { reviewVenture, SecretaryError } from "@/lib/hq/secretary";
import { addComment, buildSecretaryContext, ventureReviewInput } from "@/lib/hq/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/hq/ventures/:id/review — the secretary reviews the venture and leaves a comment. */
export const POST = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const input = ventureReviewInput(user.id, id);
  const today = await requestToday();
  try {
    const review = await reviewVenture({ context: buildSecretaryContext(user, today), ...input });
    const comment = addComment(user.id, "venture", id, "secretary", review);
    return json({ comment }, 201);
  } catch (err) {
    if (err instanceof SecretaryError) return json({ error: err.message }, err.status);
    return errorResponse(err);
  }
});
