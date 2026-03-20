"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Project {
  id: string;
  title: string;
  description: string;
  client_name: string;
  designer_name: string;
  revision_limit: number;
  revision_used: number;
  status: string;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", client_email: "", revision_limit: 3 });
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) { router.push("/login"); return; }
        const data = await r.json();
        setUser(data.user);
      })
      .catch(() => router.push("/login"));

    fetch("/api/projects")
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setProjects(data.projects);
        }
      });
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setProjects((prev) => [...prev, { ...data.project, client_name: "", designer_name: user?.name || "" }]);
      setShowCreate(false);
      setForm({ title: "", description: "", client_email: "", revision_limit: 3 });
    } else {
      const data = await res.json();
      setCreateError(data.error);
    }
  }

  if (!user) return null;

  const overLimit = projects.filter((p) => p.revision_used >= p.revision_limit && p.status !== "completed");
  const active = projects.filter((p) => p.status === "active");
  const completed = projects.filter((p) => p.status === "completed");

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              {user.role === "designer" ? "Manage your design projects" : "Track your projects"}
            </p>
          </div>
          {user.role === "designer" && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              + New Project
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold">{projects.length}</div>
            <div className="text-sm text-gray-500">Total Projects</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold">{active.length}</div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className={`text-2xl font-bold ${overLimit.length > 0 ? "text-red-600" : ""}`}>
              {overLimit.length}
            </div>
            <div className="text-sm text-gray-500">Over Revision Limit</div>
          </div>
        </div>

        {/* Create Project Form */}
        {showCreate && (
          <div className="bg-white rounded-lg border p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded">{createError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client Email</label>
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium mb-1">Revision Limit</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.revision_limit}
                  onChange={(e) => setForm({ ...form, revision_limit: parseInt(e.target.value) || 3 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                  Create Project
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 text-sm hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Project List */}
        {projects.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">
              {user.role === "designer" ? "Create your first project to get started" : "Ask your designer to add you to a project"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-white rounded-lg border p-4 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{project.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {user.role === "designer" ? `Client: ${project.client_name}` : `Designer: ${project.designer_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-medium ${
                      project.revision_used >= project.revision_limit ? "text-red-600" : "text-gray-600"
                    }`}>
                      {project.revision_used} / {project.revision_limit} revisions
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      project.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : project.status === "over_limit"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {project.status === "over_limit" ? "Over Limit" : project.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Over Limit Warning */}
        {overLimit.length > 0 && (
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-medium text-amber-800">Projects Over Revision Limit</h3>
            <p className="text-sm text-amber-700 mt-1">
              {overLimit.length} project{overLimit.length > 1 ? "s have" : " has"} exceeded the revision limit. Additional revisions require payment or approval.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
