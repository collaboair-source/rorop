"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Project {
  id: string;
  title: string;
  description: string;
  client_name: string;
  designer_name: string;
  client_id: string;
  designer_id: string;
  revision_limit: number;
  revision_used: number;
  status: string;
}

interface Version {
  id: string;
  version_number: number;
  image_url: string;
  label: string;
  notes: string;
  created_at: string;
}

interface FeedbackItem {
  id: string;
  style: string | null;
  color: string | null;
  focus: string | null;
  comment: string;
  created_at: string;
}

interface Selection {
  id: string;
  selected_version_id: string;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ image_url: "", label: "", notes: "" });
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
    });

    fetch(`/api/projects/${projectId}`).then(async (r) => {
      if (!r.ok) { router.push("/dashboard"); return; }
      const data = await r.json();
      setProject(data.project);
      setVersions(data.versions);
      setFeedbacks(data.feedbacks);
      setSelections(data.selections);
    });
  }, [projectId, router]);

  async function handleUploadVersion(e: React.FormEvent) {
    e.preventDefault();
    setUploadError("");
    const res = await fetch(`/api/projects/${projectId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uploadForm),
    });
    if (res.ok) {
      const data = await res.json();
      setVersions((prev) => [...prev, data.version]);
      setShowUpload(false);
      setUploadForm({ image_url: "", label: "", notes: "" });
    } else {
      const data = await res.json();
      setUploadError(data.error);
    }
  }

  async function handleSelectVersion(versionId: string) {
    const res = await fetch(`/api/projects/${projectId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelections((prev) => [...prev, data.selection]);
      setProject((prev) => prev ? { ...prev, status: "completed" } : prev);
    }
  }

  if (!user || !project) return null;

  const isDesigner = user.id === project.designer_id;
  const isClient = user.id === project.client_id;
  const selectedVersion = selections.length > 0 ? selections[selections.length - 1] : null;

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            {project.description && (
              <p className="text-gray-500 text-sm mt-1">{project.description}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">
              Designer: {project.designer_name} &middot; Client: {project.client_name}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${
              project.revision_used >= project.revision_limit ? "text-red-600" : "text-gray-900"
            }`}>
              {project.revision_used} / {project.revision_limit}
            </div>
            <div className="text-xs text-gray-500">Revisions Used</div>
            {project.status === "over_limit" && (
              <div className="mt-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                Limit exceeded
              </div>
            )}
            {project.status === "completed" && (
              <div className="mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                Completed
              </div>
            )}
          </div>
        </div>

        {/* Revision limit warning */}
        {project.revision_used >= project.revision_limit && project.status !== "completed" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800 font-medium">
              Revision limit reached. Additional revisions require payment or approval.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Versions Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Design Versions</h2>
              <div className="flex gap-2">
                {isDesigner && (
                  <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    + Upload Version
                  </button>
                )}
                {versions.length >= 2 && (
                  <Link
                    href={`/projects/${projectId}/compare`}
                    className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:border-gray-400"
                  >
                    Compare Versions
                  </Link>
                )}
              </div>
            </div>

            {showUpload && (
              <form onSubmit={handleUploadVersion} className="bg-white border rounded-lg p-4 mb-4 space-y-3">
                {uploadError && (
                  <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded">{uploadError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Image URL</label>
                  <input
                    type="url"
                    value={uploadForm.image_url}
                    onChange={(e) => setUploadForm({ ...uploadForm, image_url: e.target.value })}
                    required
                    placeholder="https://example.com/design.png"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Label</label>
                    <input
                      type="text"
                      value={uploadForm.label}
                      onChange={(e) => setUploadForm({ ...uploadForm, label: e.target.value })}
                      placeholder="e.g. Version A"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <input
                      type="text"
                      value={uploadForm.notes}
                      onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                      placeholder="What changed"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                    Upload
                  </button>
                  <button type="button" onClick={() => setShowUpload(false)} className="text-gray-500 text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {versions.length === 0 ? (
              <div className="bg-white border rounded-lg p-12 text-center text-gray-400">
                <p>No design versions uploaded yet</p>
                {isDesigner && <p className="text-sm mt-1">Upload your first design version above</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`bg-white border rounded-lg overflow-hidden ${
                      selectedVersion?.selected_version_id === v.id ? "ring-2 ring-green-500" : ""
                    }`}
                  >
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.image_url}
                        alt={v.label}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).parentElement!.innerHTML =
                            `<div class="flex items-center justify-center h-full text-gray-400 text-sm">${v.label}</div>`;
                        }}
                      />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{v.label}</h3>
                        {selectedVersion?.selected_version_id === v.id && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Selected</span>
                        )}
                      </div>
                      {v.notes && <p className="text-xs text-gray-500 mt-1">{v.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(v.created_at).toLocaleDateString()}
                      </p>
                      {isClient && project.status !== "completed" && versions.length >= 2 && (
                        <button
                          onClick={() => handleSelectVersion(v.id)}
                          className="mt-2 w-full border border-indigo-600 text-indigo-600 rounded-lg py-1.5 text-xs font-medium hover:bg-indigo-50"
                        >
                          Select This Version
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Feedback */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Feedback</h2>
              {isClient && project.status === "active" && (
                <Link
                  href={`/projects/${projectId}/feedback`}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Give Feedback
                </Link>
              )}
            </div>

            {feedbacks.length === 0 ? (
              <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">
                No feedback yet
              </div>
            ) : (
              <div className="space-y-3">
                {feedbacks.map((fb) => (
                  <div key={fb.id} className="bg-white border rounded-lg p-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {fb.style && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {fb.style}
                        </span>
                      )}
                      {fb.color && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {fb.color}
                        </span>
                      )}
                      {fb.focus && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {fb.focus} emphasis
                        </span>
                      )}
                    </div>
                    {fb.comment && (
                      <p className="text-sm text-gray-600">{fb.comment}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(fb.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
