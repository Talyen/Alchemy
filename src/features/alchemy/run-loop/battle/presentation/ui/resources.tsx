import { useGameTranslation } from "@/components/use-game-translation";
import { discardPile as pileDiscardArt, drawPile as pileDrawArt } from "@/lib/game-data";
import { DISCARD_PILE_TOP_CARD_BOUNDS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardHoverScaleClass,
  cardSurfaceClass,
  pileCardWidthClass,
} from "../../../../shared/config/index";
import { Surface } from "../../../../shared/ui/surface";

export function PilePanel({
  label,
  count,
  type,
  onInspect,
  inspectable = false,
  ref,
}: {
  label: string;
  count: number;
  type: "draw" | "discard";
  onInspect?: (() => void) | undefined;
  inspectable?: boolean | undefined;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const i18n = useGameTranslation();
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
          <img src={art} alt="" decoding="async" className={cn("block w-full", cardArtImageClass)} />
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
