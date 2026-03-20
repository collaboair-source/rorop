import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const store = getStore();
  const project = store.projects.find((p) => p.id === id);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.client_id !== user.id) {
    return NextResponse.json({ error: "Only the project client can submit feedback" }, { status: 403 });
  }

  if (project.revision_used >= project.revision_limit) {
    return NextResponse.json(
      { error: "Revision limit reached. Additional revisions require payment or approval." },
      { status: 429 }
    );
  }

  const { style, color, focus, comment } = await req.json();

  if (!style && !color && !focus) {
    return NextResponse.json({ error: "Select at least one feedback option" }, { status: 400 });
  }

  const feedback = {
    id: uuidv4(),
    project_id: id,
    user_id: user.id,
    style: style || null,
    color: color || null,
    focus: focus || null,
    comment: comment || "",
    created_at: new Date().toISOString(),
  };

  store.feedback.push(feedback);

  // Increment revision count
  project.revision_used += 1;
  if (project.revision_used >= project.revision_limit) {
    project.status = "over_limit";
  }

  return NextResponse.json({ feedback, revision_used: project.revision_used }, { status: 201 });
}
