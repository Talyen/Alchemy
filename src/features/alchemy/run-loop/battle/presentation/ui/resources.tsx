import { useGameTranslation } from "@/components/use-game-translation";
import { useEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { playUISound } from "@/lib/audio";
import type { BattleCard } from "@/lib/game-data";
import { discardPile as pileDiscardArt, drawPile as pileDrawArt } from "@/lib/game-data";
import { CARD_REJECTION_FEEDBACK_MS, DISCARD_PILE_TOP_CARD_BOUNDS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardHoverScaleClass,
  cardSurfaceClass,
  pileCardWidthClass,
} from "../../../../shared/config/index";
import { Surface } from "../../../../shared/ui/surface";

const EMPTY_OVERFLOW: readonly BattleCard[] = [];

function hasNewOverflowCard(previous: readonly BattleCard[], next: readonly BattleCard[]) {
  const remaining = new Map<string, number>();
  const key = (card: BattleCard) => `${card.id}:${card.uid ?? "unassigned"}`;
  for (const card of previous) remaining.set(key(card), (remaining.get(key(card)) ?? 0) + 1);
  return next.some((card) => {
    const count = remaining.get(key(card)) ?? 0;
    remaining.set(key(card), count - 1);
    return count === 0;
  });
}

export function PilePanel({
  label,
  count,
  type,
  onInspect,
  inspectable = false,
  overflowCards = EMPTY_OVERFLOW,
  openingDrawPending = false,
  ref,
}: {
  label: string;
  count: number;
  type: "draw" | "discard";
  onInspect?: (() => void) | undefined;
  inspectable?: boolean | undefined;
  overflowCards?: readonly BattleCard[];
  openingDrawPending?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const i18n = useGameTranslation();
  const reducedMotion = useReducedMotionPreference();
  const artworkRef = useRef<HTMLImageElement>(null);
  const previousOverflow = useRef<readonly BattleCard[] | null>(null);
  useEffect(() => {
    const previous = previousOverflow.current;
    previousOverflow.current = overflowCards;
    // Saved queues settle silently; a fresh opening draw still acknowledges overflow.
    if (type !== "draw" || (previous === null && !openingDrawPending)) return;
    if (!hasNewOverflowCard(previous ?? EMPTY_OVERFLOW, overflowCards)) return;
    playUISound("error");
    if (reducedMotion) return;
    const animation = artworkRef.current?.animate?.(
      [
        { translate: "0" },
        { translate: "calc(-4px * var(--content-scale, 1))" },
        { translate: "calc(4px * var(--content-scale, 1))" },
        { translate: "calc(-2px * var(--content-scale, 1))" },
        { translate: "calc(2px * var(--content-scale, 1))" },
        { translate: "0" },
      ],
      { duration: CARD_REJECTION_FEEDBACK_MS, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [overflowCards, openingDrawPending, reducedMotion, type]);
  const art = type === "draw" ? pileDrawArt : pileDiscardArt;
  return (
    <div ref={ref} data-testid={`${type}-pile`} data-count={count} className={cn("relative", pileCardWidthClass)}>
      <Surface
        as="button"
        clipContents={false}
        className={cn(cardSurfaceClass, cardHoverScaleClass, "block w-full bg-transparent")}
        ariaLabel={i18n.text("battle.inspect-pile", "Inspect {{pile}} · {{count}} cards", { pile: label, count })}
        ariaDisabled={!inspectable}
        onClick={() => {
          if (!inspectable) return;
          onInspect?.();
        }}
      >
        <div className="relative w-full">
          <img ref={artworkRef} src={art} alt="" decoding="async" className={cn("block w-full", cardArtImageClass)} />
          {type === "discard" ? (
            <span
              data-pile-top-card
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                left: `${DISCARD_PILE_TOP_CARD_BOUNDS.x * 100}%`,
                top: `${DISCARD_PILE_TOP_CARD_BOUNDS.y * 100}%`,
                width: `${DISCARD_PILE_TOP_CARD_BOUNDS.width * 100}%`,
                height: `${DISCARD_PILE_TOP_CARD_BOUNDS.height * 100}%`,
              }}
            />
          ) : null}
        </div>
      </Surface>
    </div>
  );
}
