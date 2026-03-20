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
    return NextResponse.json({ error: "Only the client can select a version" }, { status: 403 });
  }

  const { version_id } = await req.json();

  const version = store.design_versions.find((v) => v.id === version_id && v.project_id === id);
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const selection = {
    id: uuidv4(),
    project_id: id,
    selected_version_id: version_id,
    selected_by: user.id,
    created_at: new Date().toISOString(),
  };

  store.selections.push(selection);
  project.status = "completed";

  return NextResponse.json({ selection }, { status: 201 });
}
