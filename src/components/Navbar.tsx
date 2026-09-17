"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/support", label: "지원사업" },
  { href: "/support/profile", label: "내 사업 프로필" },
];

export default function Navbar({ user }: { user: { name: string; role: string } }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="text-lg font-bold text-indigo-600">
            RevisionMgr
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {LINKS.map((l) => {
              const active = l.href === "/support" ? pathname === "/support" || (pathname?.startsWith("/support/") && !pathname.startsWith("/support/profile")) : pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
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
      <div className="sm:hidden max-w-6xl mx-auto flex gap-1 mt-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="px-3 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-50">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
