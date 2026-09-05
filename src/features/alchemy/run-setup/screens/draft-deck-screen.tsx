import { useMemo, useState } from "react";
import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import { DRAFT_ROUNDS } from "@/lib/game-constants";

import { Button } from "@/components/ui/button";
import {
  BUTTON_WIDTH_ACTION,
  bodyTextClass,
  collectionTileWidthClass,
  getPlasmaColorPair,
} from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { BattleCardButton } from "../../shared/ui/card-button";
import { getCardDisplayTitle } from "../../shared/ui/card-description-ui";
import { SelectableCard } from "../../shared/ui/selectable-card";
import { FadeSlot } from "../../shared/ui/use-fade";
import { TitledScreenShell } from "../../shared/ui/shared-ui";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

function DraftedCardItem({ card, onHoverChange }: { card: BattleCard; onHoverChange: (hovered: boolean) => void }) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    `drafted-${card.id}`,
    card.id,
  );

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={() => {
        onHoverStart();
        onHoverChange(true);
      }}
      onHoverEnd={() => {
        onHoverEnd();
        onHoverChange(false);
      }}
      ariaLabel={getCardDisplayTitle(card)}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      scaleOnHover={false}
      className={collectionTileWidthClass}
      wrapperClassName="relative flex justify-center"
    />
  );
}

interface Props {
  onComplete: () => void;
  draftedCards: BattleCard[];
  draftChoices: BattleCard[];
  onPick: (cardId: string) => void;
}

export function DraftDeckScreen({ onComplete, draftedCards, draftChoices, onPick }: Props) {
  const round = draftedCards.length;
  const isComplete = draftedCards.length >= DRAFT_ROUNDS;
  const [hoveredCard, setHoveredCard] = useState<BattleCard | null>(null);

  const plasmaKeywordIds = useMemo(() => {
    if (!hoveredCard) return null;
    return getCardKeywords(hoveredCard);
  }, [hoveredCard]);
  usePlasmaInteraction(plasmaKeywordIds ? getPlasmaColorPair(plasmaKeywordIds) : null, plasmaKeywordIds !== null);

  return (
    <TitledScreenShell title={isComplete ? "Draft Complete" : "Draft a Deck"} maxWidthClass="max-w-6xl">
      <p className={cn("mt-3 text-center", bodyTextClass)}>
        {isComplete
          ? `You drafted ${String(draftedCards.length)} cards. Ready to begin your run.`
          : `Pick 1 of 3 cards - ${String(round + 1)}/${String(DRAFT_ROUNDS)} selected`}
      </p>

      <FadeSlot swapKey={isComplete ? "complete" : round} className="mx-auto mt-8 min-h-[36cqh] w-full">
        {isComplete ? (
          <div className="mx-auto grid max-w-fit grid-cols-3 justify-items-center gap-6">
            {draftedCards.map((card, index) => (
              <DraftedCardItem
                key={`drafted-${card.id}-${String(card.uid ?? index)}`}
                card={card}
                onHoverChange={(hovered) => setHoveredCard(hovered ? card : null)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-center gap-6">
            {draftChoices.map((card, index) => (
              <SelectableCard
                key={`draft-choice-${String(index)}-${card.id}`}
                card={card}
                isSelected={false}
                onSelect={() => onPick(card.id)}
                interactionKey={`draft-choice-${String(index)}`}
                onHoverChange={(hovered) => setHoveredCard(hovered ? card : null)}
              />
            ))}
          </div>
        )}
      </FadeSlot>

      {isComplete ? (
        <div className="mt-8 flex justify-center">
          <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={() => onComplete()}>
            Continue
          </Button>
        </div>
      ) : null}
    </TitledScreenShell>
  );
}
