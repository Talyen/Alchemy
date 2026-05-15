// Wish selection overlay for battle.
import type { CSSProperties } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { WISH_OVERLAY_Z_INDEX } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data";

import { BattleCardButton, getCardDisplayTitle } from "../../components";
import { handCardWidthClass, mobileStageHandCardWidthClass } from "../../config";
import { getHoverId } from "../../utils";
import type { BattleActionsProps, BattleHoverProps, BattleScreenState } from "./types";

export function WishOverlay({
  battleState,
  hover,
  actions,
  isMobileLandscape,
}: {
  battleState: BattleScreenState;
  hover: BattleHoverProps;
  actions: BattleActionsProps;
  isMobileLandscape: boolean;
}) {
  const { hoveredCardId, setHoveredCardId, shimmerState, onHoverShimmer } = hover;
  const { onWishChoice } = actions;
  const [wishSelectedCard, setWishSelectedCard] = useState<BattleCard | null>(null);
  const handWidthClass = isMobileLandscape ? mobileStageHandCardWidthClass : handCardWidthClass;

  return (
    <div className="motion-overlay absolute inset-0 flex items-center justify-center bg-black/70 px-6" style={{ zIndex: WISH_OVERLAY_Z_INDEX }}>
      <div className="motion-panel alchemy-shell w-full max-w-5xl rounded-[28px] border border-border/80 px-6 py-6">
        <div className="text-center">
          <h2 className="text-2xl text-foreground">Wish</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose one card to add to your hand.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-start justify-center gap-5">
          {battleState.wishOptions?.map((card, index) => {
            const hoverId = getHoverId("wish", card.id);
            const isSelected = wishSelectedCard?.id === card.id;

            return (
              <BattleCardButton
                key={card.id}
                card={card}
                hovered={hoveredCardId === hoverId}
                onHoverStart={() => {
                  setHoveredCardId(hoverId);
                  onHoverShimmer(hoverId);
                }}
                onHoverEnd={() => setHoveredCardId((current) => (current === hoverId ? null : current))}
                onClick={() => setWishSelectedCard(card)}
                ariaLabel={`Choose ${getCardDisplayTitle(card)}`}
                shimmerActive={shimmerState?.cardId === hoverId}
                shimmerToken={shimmerState?.token}
                className={handWidthClass}
                wrapperClassName="stagger-item relative flex justify-center"
                wrapperStyle={{ "--stagger-index": index } as CSSProperties}
                selected={isSelected}
              />
            );
          })}
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Button
            size="lg"
            disabled={!wishSelectedCard}
            onClick={() => {
              onWishChoice(wishSelectedCard!);
              setWishSelectedCard(null);
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
