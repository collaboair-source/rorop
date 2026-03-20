"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

const STYLE_OPTIONS = ["luxury", "minimal", "trendy", "bold"] as const;
const COLOR_OPTIONS = ["bright", "dark", "warm", "cool"] as const;
const FOCUS_OPTIONS = [
  { value: "text", label: "Text Emphasis" },
  { value: "image", label: "Image Emphasis" },
  { value: "brand", label: "Brand Emphasis" },
] as const;

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function FeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!style && !color && !focus) {
      setError("Please select at least one option");
      return;
    }

    setError("");
    setLoading(true);

    const res = await fetch(`/api/projects/${projectId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style, color, focus, comment }),
    });

    if (res.ok) {
      router.push(`/projects/${projectId}`);
    } else {
      const data = await res.json();
      setError(data.error);
    }
    setLoading(false);
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href={`/projects/${projectId}`} className="text-sm text-indigo-600 hover:underline mb-4 inline-block">
          &larr; Back to Project
        </Link>
        <h1 className="text-2xl font-bold mb-2">Submit Feedback</h1>
        <p className="text-gray-500 text-sm mb-8">
          Select your preferences below. This structured feedback helps your designer deliver exactly what you want.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded">{error}</div>
          )}

          {/* Style */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Style Preference</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStyle(style === opt ? null : opt)}
                  className={`py-3 rounded-lg text-sm font-medium border transition-all ${
                    style === opt
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Color Tone */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Color Tone</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setColor(color === opt ? null : opt)}
                  className={`py-3 rounded-lg text-sm font-medium border transition-all ${
                    color === opt
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Focus */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Focus Area</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFocus(focus === opt.value ? null : opt.value)}
                  className={`py-3 rounded-lg text-sm font-medium border transition-all ${
                    focus === opt.value
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment (optional) */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Additional Comments <span className="text-gray-400 font-normal">(optional)</span>
            </h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Any additional notes for your designer..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Feedback"}
            </button>
            <Link
              href={`/projects/${projectId}`}
              className="px-6 py-2.5 text-gray-500 text-sm hover:text-gray-700"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
