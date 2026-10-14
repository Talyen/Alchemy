import { pileDiscardArt, pileDrawArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { DISCARD_PILE_TOP_CARD_BOUNDS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardHoverScaleClass,
  cardSurfaceClass,
  pileCardWidthClass,
} from "../../../../shared/config/index";
import { Surface } from "../../../../shared/ui/surface";
export { ManaPanel } from "./mana-dock";

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
