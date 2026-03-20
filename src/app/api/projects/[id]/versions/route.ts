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
  if (project.designer_id !== user.id) {
    return NextResponse.json({ error: "Only the project designer can upload versions" }, { status: 403 });
  }

  const { image_url, label, notes } = await req.json();

  if (!image_url) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  const existingVersions = store.design_versions.filter((v) => v.project_id === id);
  const nextNumber = existingVersions.length + 1;

  const version = {
    id: uuidv4(),
    project_id: id,
    version_number: nextNumber,
    image_url,
    label: label || `Version ${String.fromCharCode(64 + nextNumber)}`,
    notes: notes || "",
    created_at: new Date().toISOString(),
  };

  store.design_versions.push(version);

  return NextResponse.json({ version }, { status: 201 });
}
