import { battleManaCrystal, pileDiscardArt, pileDrawArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { DISCARD_PILE_TOP_CARD_BOUNDS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardHoverScaleClass,
  cardSurfaceClass,
  pileCardWidthClass,
} from "../../../../shared/config/index";
import { Surface } from "../../../../shared/ui/surface";
import { useChangeToken } from "../../../../shared/ui/use-change-token";

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
        className={cn(cardSurfaceClass, cardHoverScaleClass, "block w-full bg-transparent")}
        ariaLabel={`Inspect ${label} · ${count} cards`}
        ariaDisabled={!inspectable}
        onClick={(event) => {
          if (!inspectable) return;
          event.currentTarget.focus();
          onInspect?.();
        }}
      >
        <div className="relative w-full">
          <img src={art} alt="" className={cn("block w-full", cardArtImageClass)} />
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

export function ManaPanel({ mana, maxMana }: { mana: number; maxMana: number }) {
  const displayCount = Math.max(mana, maxMana);

  return (
    <div
      className={cn("flex h-16 items-center justify-center", cardHoverScaleClass)}
      data-testid="mana-panel"
      data-mana={mana}
    >
      <div
        className="mana-row relative flex items-center justify-center gap-1.5"
        role="img"
        aria-label={`Mana: ${mana} / ${maxMana}`}
      >
        {Array.from({ length: displayCount }).map((_, index) => {
          const isFilled = index < mana;
          const isOverflow = index >= maxMana;
          return (
            <span key={`mana-${index}`} className="mana-gem relative inline-flex">
              <ManaCrystal filled={isFilled} overflow={isOverflow} />
              <span
                aria-hidden="true"
                className={cn("mana-gem-glint", !isFilled && "opacity-20")}
                style={{ maskImage: `url(${battleManaCrystal})` }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ManaCrystal({ filled, overflow }: { filled: boolean; overflow: boolean }) {
  const token = useChangeToken(Number(filled));
  return (
    <img
      key={token}
      src={battleManaCrystal}
      alt=""
      draggable={false}
      className={cn(
        "h-[calc(1.8225*var(--content-rem,1rem))] w-[calc(1.8225*var(--content-rem,1rem))] object-contain select-none",
        filled && "mana-gem-active",
        token > 0 && !filled && "mana-gem-spent",
        filled && overflow && "brightness-125 drop-shadow-mana-overflow-glow",
        !filled && "opacity-20",
      )}
    />
  );
}
