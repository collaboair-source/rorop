"use client";

/** 포토카드 앨범 그리드 (04 문서 3.10) — 3열, 잠긴 카드는 홀로 뒷면 + 힌트. */

import { Photocard, cardFallback } from "./Photocard";
import type { CardDef } from "./album";

export function AlbumGrid({
  cards,
  owned,
  onOpen,
}: {
  cards: CardDef[];
  owned: ReadonlySet<string>;
  onOpen: (card: CardDef) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2.5" data-testid="album-grid">
      {cards.map((card) => {
        const locked = !owned.has(card.id);
        return (
          <li key={card.id}>
            <Photocard
              src={locked ? undefined : card.src}
              frame={card.frame}
              label={locked ? undefined : card.label}
              sublabel={locked ? undefined : card.sublabel}
              locked={locked}
              hint={card.hint}
              size="lg"
              onClick={() => onOpen(card)}
              fallback={cardFallback(card)}
              ariaLabel={locked ? `잠긴 카드: ${card.hint}` : card.label}
              testId={`album-card-${card.id}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
