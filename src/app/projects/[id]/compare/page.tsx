"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Version {
  id: string;
  version_number: number;
  image_url: string;
  label: string;
  notes: string;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ComparePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) { router.push("/login"); return; }
      const data = await r.json();
      setUser(data.user);
    });

    fetch(`/api/projects/${projectId}`).then(async (r) => {
      if (!r.ok) { router.push("/dashboard"); return; }
      const data = await r.json();
      setVersions(data.versions);
      if (data.versions.length >= 2) {
        setSelectedA(data.versions[0].id);
        setSelectedB(data.versions[data.versions.length - 1].id);
      }
    });
  }, [projectId, router]);

  if (!user) return null;

  const versionA = versions.find((v) => v.id === selectedA);
  const versionB = versions.find((v) => v.id === selectedB);

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link href={`/projects/${projectId}`} className="text-sm text-indigo-600 hover:underline mb-4 inline-block">
          &larr; Back to Project
        </Link>
        <h1 className="text-2xl font-bold mb-6">Compare Versions</h1>

        {/* Selectors */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Version A</label>
            <select
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Version B</label>
            <select
              value={selectedB}
              onChange={(e) => setSelectedB(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Side by Side Comparison */}
        <div className="grid grid-cols-2 gap-6">
          {versionA && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={versionA.image_url}
                  alt={versionA.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).parentElement!.innerHTML =
                      `<div class="flex items-center justify-center h-full text-gray-400 text-sm">${versionA.label}</div>`;
                  }}
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{versionA.label}</h3>
                {versionA.notes && <p className="text-sm text-gray-500 mt-1">{versionA.notes}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(versionA.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
          {versionB && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={versionB.image_url}
                  alt={versionB.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).parentElement!.innerHTML =
                      `<div class="flex items-center justify-center h-full text-gray-400 text-sm">${versionB.label}</div>`;
                  }}
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{versionB.label}</h3>
                {versionB.notes && <p className="text-sm text-gray-500 mt-1">{versionB.notes}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(versionB.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
