import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const store = getStore();
  const project = store.projects.find((p) => p.id === id);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.client_id !== user.id && project.designer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = store.users.find((u) => u.id === project.client_id);
  const designer = store.users.find((u) => u.id === project.designer_id);
  const versions = store.design_versions
    .filter((v) => v.project_id === id)
    .sort((a, b) => a.version_number - b.version_number);
  const feedbacks = store.feedback
    .filter((f) => f.project_id === id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const selections = store.selections.filter((s) => s.project_id === id);

  return NextResponse.json({
    project: {
      ...project,
      client_name: client?.name || "Unknown",
      designer_name: designer?.name || "Unknown",
    },
    versions,
    feedbacks,
    selections,
  });
}
