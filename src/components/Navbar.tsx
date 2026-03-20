"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Navbar({ user }: { user: { name: string; role: string } }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-bold text-indigo-600">
          RevisionMgr
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {user.name}{" "}
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
              {user.role}
            </span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
