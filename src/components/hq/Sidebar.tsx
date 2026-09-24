"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";
import type { HqUser } from "./HqUserContext";

const NAV = [
  { href: "/hq", label: "사령부", icon: "◎", exact: true, also: ["/hq/search"] },
  { href: "/hq/ventures", label: "사업", icon: "▣", also: [] as string[] },
  { href: "/hq/tasks", label: "할 일", icon: "☑", also: [] as string[] },
  { href: "/hq/secretary", label: "비서", icon: "✦", also: [] as string[] },
  { href: "/hq/import", label: "Claude 가져오기", icon: "⇩", also: ["/hq/knowledge"] },
  { href: "/hq/settings", label: "설정 · 백업", icon: "⚙", also: [] as string[] },
];

const EXTERNAL = [{ href: "/dashboard", label: "디자인 리비전 관리", icon: "◫" }];

export default function Sidebar({ user }: { user: HqUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isActive = (item: { href: string; exact?: boolean; also: string[] }) =>
    (item.exact ? pathname === item.href : matches(item.href)) || item.also.some(matches);

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/login", { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      alert("로그아웃에 실패했습니다. 다시 시도하세요.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  const search = (
    <form
      className="mb-3"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;
        setOpen(false);
        router.push(`/hq/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="검색 (사업·할 일·자료·코멘트)"
        aria-label="전체 검색"
        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </form>
  );

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(item) ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
          )}
        >
          <span className="w-5 text-center text-base leading-none">{item.icon}</span>
          {item.label}
        </Link>
      ))}
      <div className="mt-4 mb-1 px-3 text-[11px] uppercase tracking-wider text-gray-500">다른 모듈</div>
      {EXTERNAL.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <span className="w-5 text-center text-base leading-none">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-gray-800 pt-3 mt-3">
      <div className="px-3 text-sm text-white font-medium truncate">{user.name}</div>
      <div className="px-3 text-xs text-gray-500 truncate">{user.email}</div>
      <button onClick={handleLogout} className="mt-2 px-3 text-xs text-gray-400 hover:text-white">
        로그아웃
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-gray-900 text-white px-4 py-3">
        <Link href="/hq" className="font-bold tracking-tight">
          Rorop <span className="text-indigo-400">HQ</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="text-gray-300 hover:text-white text-xl leading-none" aria-label="메뉴">
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setOpen(false)}>
          <aside className="absolute top-12 left-0 right-0 bg-gray-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {search}
            {nav}
            {footer}
          </aside>
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 bg-gray-900 text-white min-h-screen sticky top-0 h-screen p-4">
        <Link href="/hq" className="px-3 py-2 mb-4 block">
          <div className="text-lg font-bold tracking-tight">
            Rorop <span className="text-indigo-400">HQ</span>
          </div>
          <div className="text-xs text-gray-500">나의 비서 · 업무 사령부</div>
        </Link>
        {search}
        {nav}
        <div className="flex-1" />
        {footer}
      </aside>
    </>
  );
}
