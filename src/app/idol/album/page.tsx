"use client";

/** 포토카드 앨범 (백스테이지, 04 문서 3.10) — 세트 탭 5개 + 3열 그리드 + 전체 화면 뷰어. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAlbum, loadEndings } from "@/game/idol/save";
import type { EndingGalleryEntry } from "@/game/idol/types";
import { AlbumGrid } from "@/components/idol/AlbumGrid";
import { CardViewer } from "@/components/idol/CardViewer";
import { Icon } from "@/components/idol/ui";
import {
  CARD_SETS,
  CARD_SET_LABELS,
  CARD_TOTAL,
  cardsOfSet,
  type CardDef,
  type CardSet,
} from "@/components/idol/album";
import { dateText, monthLabel } from "@/components/idol/format";

function isCardSet(value: string | null): value is CardSet {
  return value !== null && (CARD_SETS as string[]).includes(value);
}

/** ?tab=ending — Next 는 location.search, 단일 HTML 은 해시 뒤 쿼리에서 읽는다 */
function initialTab(): CardSet {
  if (typeof window === "undefined") return "trainee";
  const fromSearch = new URLSearchParams(window.location.search).get("tab");
  if (isCardSet(fromSearch)) return fromSearch;
  const hash = window.location.hash;
  const at = hash.indexOf("?");
  if (at >= 0) {
    const fromHash = new URLSearchParams(hash.slice(at + 1)).get("tab");
    if (isCardSet(fromHash)) return fromHash;
  }
  return "trainee";
}

export default function IdolAlbumPage() {
  const router = useRouter();
  const [booted, setBooted] = useState(false);
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set<string>());
  const [endings, setEndings] = useState<Record<string, EndingGalleryEntry>>({});
  const [tab, setTab] = useState<CardSet>("trainee");
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    setOwned(new Set(loadAlbum()));
    const map: Record<string, EndingGalleryEntry> = {};
    for (const e of loadEndings()) map[e.id] = e;
    setEndings(map);
    setTab(initialTab());
    setBooted(true);
  }, []);

  const cards = useMemo(() => cardsOfSet(tab), [tab]);
  const ownedInTab = cards.filter((c) => owned.has(c.id)).length;

  const meta = useCallback(
    (card: CardDef): string | null => {
      if (card.set !== "ending") return null;
      const entry = endings[card.id.slice("ending:".length)];
      if (!entry) return null;
      return `${entry.idolName} · ${monthLabel(entry.month)} · ${dateText(entry.achievedAt)}`;
    },
    [endings],
  );

  return (
    <main className="flex flex-1 flex-col px-4 pb-8 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/idol")}
          data-testid="back-title"
          aria-label="타이틀로"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
        >
          <Icon name="back" size={20} />
        </button>
        <p className="text-[12px] font-bold tracking-[0.14em] text-[var(--ink-3)]">앨범</p>
        <span className="h-11 w-11" aria-hidden="true" />
      </div>

      <h1 className="mt-1 text-[24px] font-extrabold text-[var(--ink)]">
        포토카드 앨범{" "}
        <span className="num text-[16px] text-[var(--accent-ink)]" data-testid="album-count">
          {booted ? owned.size : 0}/{CARD_TOTAL}
        </span>
      </h1>

      <div
        className="idol-no-scrollbar -mx-4 mb-3 mt-2 flex gap-1 overflow-x-auto border-b border-[var(--line)] px-4"
        role="tablist"
      >
        {CARD_SETS.map((set) => {
          const on = tab === set;
          return (
            <button
              key={set}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(set)}
              data-testid={`album-tab-${set}`}
              className={[
                "min-h-[44px] shrink-0 border-b-2 px-3 text-[13px] font-bold transition-colors duration-[120ms]",
                on
                  ? "border-[var(--accent)] text-[var(--accent-ink)]"
                  : "border-transparent text-[var(--ink-3)]",
              ].join(" ")}
            >
              {CARD_SET_LABELS[set]}
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-[12px] text-[var(--ink-2)]">
        {CARD_SET_LABELS[tab]} {ownedInTab}/{cards.length}장
      </p>

      <AlbumGrid
        cards={cards}
        owned={owned}
        onOpen={(card) => setViewer(cards.findIndex((c) => c.id === card.id))}
      />

      <p className="mt-5 text-center text-[11px] leading-5 text-[var(--ink-3)]">
        카드는 게임 안에서 그 장면을 처음 마주칠 때 열린다.
      </p>

      {viewer !== null ? (
        <CardViewer
          cards={cards}
          index={viewer}
          owned={owned}
          meta={meta}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </main>
  );
}
