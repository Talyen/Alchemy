// Wish selection overlay for battle.
import type { CSSProperties } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/card-button";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { ScreenHeader } from "../../../shared/ui/shared-ui";
import { handCardWidthClass } from "@/features/alchemy/shared/config";
import type { BattleActionsProps, BattleScreenState } from "./types";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import type { CardDescriptionContext } from "../../../shared/utils/card-description";

function WishCardItem({
  card,
  index,
  handWidthClass,
  selected,
  onSelect,
  descriptionContext,
}: {
  card: BattleCard;
  index: number;
  handWidthClass: string;
  selected: boolean;
  onSelect: (card: BattleCard) => void;
  descriptionContext: CardDescriptionContext;
}) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("wish", card.id);

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={() => onSelect(card)}
      ariaLabel={`Choose ${getCardDisplayTitle(card)}`}
      descriptionContext={descriptionContext}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      className={handWidthClass}
      wrapperClassName="stagger-item relative flex justify-center"
      wrapperStyle={{ "--stagger-index": index } as CSSProperties}
      selected={selected}
    />
  );
}

export function WishOverlay({ battleState, actions }: { battleState: BattleScreenState; actions: BattleActionsProps }) {
  const { onWishChoice } = actions;
  const [wishSelectedCard, setWishSelectedCard] = useState<BattleCard | null>(null);
  const handWidthClass = handCardWidthClass;

  const descriptionContext = {
    ...battleState.talentEffects,
    companionDamageBonus: battleState.trinketEffects.companionDamageBonus,
    companionDamageBuff: battleState.companionDamageBuff,
  };

  return (
    <div className="wish-overlay-backdrop z-wish-overlay absolute inset-0 flex items-center justify-center bg-black/70 px-6">
      <div className="wish-overlay-panel alchemy-shell w-full max-w-5xl rounded-shell-screen border border-border/80 px-6 py-6">
        <ScreenHeader title="Wish" />
        <p className="mt-2 text-center text-sm text-muted-foreground">Choose one card to add to your hand, or skip.</p>

        <div className="mt-6 flex flex-wrap items-start justify-center gap-5">
          {battleState.wishOptions?.map((card, index) => (
            <WishCardItem
              key={card.id}
              card={card}
              index={index}
              handWidthClass={handWidthClass}
              selected={wishSelectedCard?.id === card.id}
              onSelect={setWishSelectedCard}
              descriptionContext={descriptionContext}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              onWishChoice(null);
              setWishSelectedCard(null);
            }}
          >
            Skip
          </Button>
          <Button
            size="lg"
            disabled={!wishSelectedCard}
            onClick={() => {
              onWishChoice(wishSelectedCard);
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
