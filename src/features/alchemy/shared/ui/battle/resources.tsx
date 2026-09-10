import { battleManaCrystal, pileDiscardArt, pileDrawArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { cardArtImageClass, cardSurfaceClass, pileCardWidthClass } from "../../config";
import { Surface } from "../surface";
import { GoldPill } from "../material-icons";
import { useChangeToken } from "./use-change-token";

export function PilePanel({
  label,
  count,
  type,
  compact = false,
  onInspect,
  inspectable = false,
  ref,
}: {
  label: string;
  count: number;
  type: "draw" | "discard";
  compact?: boolean;
  onInspect?: (() => void) | undefined;
  inspectable?: boolean | undefined;
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
      </div>
    );
  }
  return (
    <div ref={ref} data-testid={`${type}-pile`} data-count={count} className={cn("relative", pileCardWidthClass)}>
      <Surface
        as="button"
        className={cn(cardSurfaceClass, "block w-full bg-transparent")}
        ariaLabel={`Inspect ${label} · ${count} cards`}
        ariaDisabled={!inspectable}
        onClick={(event) => {
          if (!inspectable) return;
          event.currentTarget.focus();
          onInspect?.();
        }}
      >
        <img src={art} alt="" className={cn("block w-full", cardArtImageClass)} />
      </Surface>
    </div>
  );
}

export function ManaPanel({ mana, maxMana, gold }: { mana: number; maxMana: number; gold: number }) {
  const displayCount = Math.max(mana, maxMana);
  const manaToken = useChangeToken(`${mana}-${maxMana}`);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="mana-panel" data-mana={mana}>
      <GoldPill amount={gold} />
      <div className="flex items-center justify-center gap-1.5" role="img" aria-label={`Mana: ${mana} / ${maxMana}`}>
        {Array.from({ length: displayCount }).map((_, index) => {
          const isFilled = index < mana;
          const isOverflow = index >= maxMana;
          return (
            <img
              key={`mana-${index}-${manaToken}-${isFilled}`}
              src={battleManaCrystal}
              alt=""
              draggable={false}
              className={cn(
                "h-[calc(1.8225*var(--content-rem,1rem))] w-[calc(1.8225*var(--content-rem,1rem))] object-contain transition-opacity duration-200 select-none",
                isFilled && "mana-gem-active",
                isFilled && isOverflow && "brightness-125 drop-shadow-mana-overflow-glow",
                !isFilled && "opacity-20",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
