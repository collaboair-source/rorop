"use client";

// Auth-guarded shell for every /hq page: sidebar + main column.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/hq/Sidebar";
import { HqUserContext } from "@/components/hq/HqUserContext";
import type { HqUser } from "@/components/hq/HqUserContext";
import { LoadingBlock } from "@/components/hq/ui";

export default function HqLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<HqUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Tell the server which calendar day "today" is for this user (e.g. Asia/Seoul on a UTC host).
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) document.cookie = `hq_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // ignore: server falls back to its own local day
    }
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) {
          router.replace("/login");
          return;
        }
        const data = await r.json();
        if (!cancelled) setUser(data.user);
      })
      .catch(() => router.replace("/login"));
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LoadingBlock label="HQ 준비 중..." />
      </div>
    );
  }

  return (
    <HqUserContext.Provider value={user}>
      <div className="min-h-screen bg-gray-50 lg:flex">
        <Sidebar user={user} />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </HqUserContext.Provider>
  );
}
