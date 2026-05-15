// Battle resource widgets for draw/discard piles, mana, and gold.
// Depends on game-data pile art, card styling, and value-change animation tokens.
// Used by BattleScreen controls.
import { type CSSProperties } from "react";
import { Coins, Gem } from "lucide-react";

import { pileDiscardArt, pileDrawArt } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, pileCardWidthClass, staticCardTransform } from "../../config";
import { clearTiltFromEvent, setTiltFromEvent } from "../../utils";
import { useChangeToken } from "./use-change-token";

// Shows a tactile pile card on desktop and a compact counter on mobile battle layout.
export function PilePanel({
  label,
  count,
  type,
  compact = false,
}: {
  label: string;
  count: number;
  type: "draw" | "discard";
  compact?: boolean;
}) {
  const art = type === "draw" ? pileDrawArt : pileDiscardArt;
  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        data-testid={`${type}-pile`}
        data-count={count}
      >
        <span className="font-semibold uppercase tracking-wider">{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
    );
  }
  return (
    <div
      className={cn("tilt-surface", cardSurfaceClass, pileCardWidthClass, "bg-transparent")}
      data-testid={`${type}-pile`}
      data-count={count}
      onMouseMove={setTiltFromEvent}
      onMouseLeave={clearTiltFromEvent}
      style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
    >
      <img src={art} alt={`${label} pile`} className="block w-full rounded-[30px] aspect-[3/4] object-cover" loading="lazy" />
    </div>
  );
}

// Renders gold plus mana gems, including temporary mana overflow above the max.
export function ManaPanel({ mana, maxMana, gold }: { mana: number; maxMana: number; gold: number }) {
  // Show temporary mana overflow by rendering up to current mana, not just max mana;
  // otherwise mana-grant cards could appear to do nothing above the cap.
  const displayCount = Math.max(mana, maxMana);
  const manaToken = useChangeToken(`${mana}-${maxMana}`);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="mana-panel" data-mana={mana}>
      <div className="flex items-center gap-1 text-sm font-medium text-yellow-300">
        <Coins className="h-4 w-4" />
        <span>{gold}</span>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: displayCount }).map((_, index) => {
          const isFilled = index < mana;
          const isOverflow = index >= maxMana;
          return (
            <Gem
              key={`mana-${index}-${manaToken}-${isFilled}`}
              className={cn(
                "h-[22px] w-[22px] transition-opacity duration-200",
                isFilled && "mana-gem-active",
                isFilled && isOverflow && "text-sky-300 drop-shadow-[0_0_3px_rgba(125,211,252,0.6)]",
                isFilled && !isOverflow && "text-[#2c4f88]",
                !isFilled && "text-[#2c4f88]/20",
              )}
              strokeWidth={2.2}
            />
          );
        })}
      </div>
    </div>
  );
}
