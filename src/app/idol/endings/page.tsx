"use client";

/** 엔딩 도감은 앨범의 엔딩 탭이 흡수했다 (04 문서 3.10). 이 경로는 리다이렉트만 한다. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IdolEndingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/idol/album?tab=ending");
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <p className="idol-pulse text-[13px] text-[var(--ink-3)]">포토카드 앨범으로 이동 중…</p>
    </main>
  );
}
