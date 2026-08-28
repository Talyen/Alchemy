import { Coins, Gem } from "lucide-react";

import { pileDiscardArt, pileDrawArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { cardArtImageClass, cardSurfaceClass, pileCardWidthClass } from "../../config";
import { TiltSurface } from "../tilt-surface";
import { useChangeToken } from "./use-change-token";

export function PilePanel({
  label,
  count,
  type,
  compact = false,
  ref,
}: {
  label: string;
  count: number;
  type: "draw" | "discard";
  compact?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const art = type === "draw" ? pileDrawArt : pileDiscardArt;
  if (compact) {
    return (
      <div
        ref={ref}
        className="flex items-center gap-1.5 text-base font-semibold text-muted-foreground"
        data-testid={`${type}-pile`}
        data-count={count}
      >
        <span className="font-semibold tracking-wider uppercase">{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
    );
  }
  return (
    <TiltSurface
      surfaceRef={ref}
      testId={`${type}-pile`}
      dataCount={count}
      className={cn(cardSurfaceClass, pileCardWidthClass, "bg-transparent")}
    >
      <img src={art} alt={`${label} pile`} className={cn("block w-full", cardArtImageClass)} />
    </TiltSurface>
  );
}

export function ManaPanel({ mana, maxMana, gold }: { mana: number; maxMana: number; gold: number }) {
  const displayCount = Math.max(mana, maxMana);
  const manaToken = useChangeToken(`${mana}-${maxMana}`);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="mana-panel" data-mana={mana}>
      <div className="flex items-center gap-1.5 text-lg font-medium text-yellow-300">
        <Coins className="h-[2.7cqh] w-[2.7cqh]" />
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
                "h-[2.7cqh] w-[2.7cqh] transition-opacity duration-200",
                isFilled && "mana-gem-active",
                isFilled && isOverflow && "text-sky-300 drop-shadow-mana-overflow-glow",
                isFilled && !isOverflow && "text-mana-gem",
                !isFilled && "text-mana-gem/20",
              )}
              strokeWidth={2.2}
            />
          );
        })}
      </div>
    </div>
  );
}
