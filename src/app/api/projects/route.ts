import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = getStore();
  const projects = store.projects.filter(
    (p) => p.client_id === user.id || p.designer_id === user.id
  );

  // Enrich with user names
  const enriched = projects.map((p) => {
    const client = store.users.find((u) => u.id === p.client_id);
    const designer = store.users.find((u) => u.id === p.designer_id);
    return {
      ...p,
      client_name: client?.name || "Unknown",
      designer_name: designer?.name || "Unknown",
    };
  });

  return NextResponse.json({ projects: enriched });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "designer") {
    return NextResponse.json({ error: "Only designers can create projects" }, { status: 403 });
  }

  const { title, description, client_email, revision_limit } = await req.json();

  if (!title || !client_email) {
    return NextResponse.json({ error: "Title and client email are required" }, { status: 400 });
  }

  const store = getStore();
  const client = store.users.find((u) => u.email === client_email && u.role === "client");
  if (!client) {
    return NextResponse.json({ error: "Client not found. They must register first." }, { status: 404 });
  }

  const project = {
    id: uuidv4(),
    title,
    description: description || "",
    client_id: client.id,
    designer_id: user.id,
    revision_limit: revision_limit || 3,
    revision_used: 0,
    status: "active" as const,
    created_at: new Date().toISOString(),
  };

  store.projects.push(project);

  return NextResponse.json({ project }, { status: 201 });
}
