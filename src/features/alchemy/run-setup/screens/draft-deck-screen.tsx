import { useGameTranslation } from "@/components/use-game-translation";

import { useMemo, useState } from "react";
import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import { DRAFT_ROUNDS } from "@/lib/game-constants";

import { Button } from "@/components/ui/button";
import {
  bodyTextClass,
  collectionTileWidthClass,
  getCardInspectionShineColors,
  getPlasmaColorPair,
} from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { getCardDisplayTitle } from "../../shared/ui/cards/card-description-ui";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { FadeSlot } from "../../shared/ui/use-fade";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

// Keep two rows of artwork clear of the heading and Continue at large game sizes.
const DRAFTED_CARD_WIDTH_CLASS = cn(
  collectionTileWidthClass,
  "max-w-[calc((100cqh_-_20*var(--content-rem,1rem))*0.375)]",
);

function DraftedCardItem({
  card,
  interactionKey,
  onHoverChange,
}: {
  card: BattleCard;
  interactionKey: string;
  onHoverChange: (hovered: boolean) => void;
}) {
  const i18n = useGameTranslation();
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    interactionKey,
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
      ariaLabel={i18n.read(() => getCardDisplayTitle(card))}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      scaleOnHover={false}
      shineColor={getCardInspectionShineColors(card)}
      className={DRAFTED_CARD_WIDTH_CLASS}
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
  const i18n = useGameTranslation();
  const round = draftedCards.length;
  const isComplete = draftedCards.length >= DRAFT_ROUNDS;
  const [hoveredCard, setHoveredCard] = useState<BattleCard | null>(null);

  const plasmaKeywordIds = useMemo(() => {
    if (!hoveredCard) return null;
    return getCardKeywords(hoveredCard);
  }, [hoveredCard]);
  usePlasmaInteraction(plasmaKeywordIds ? getPlasmaColorPair(plasmaKeywordIds) : null, plasmaKeywordIds !== null);

  return (
    <FadeSlot swapKey={isComplete ? "complete" : round} className="h-full w-full">
      <TitledScreenShell
        title={i18n.displayText(
          isComplete
            ? i18n.text("ui.draft-deck-screen.d1", "Draft Complete")
            : i18n.text("ui.draft-deck-screen.d2", "Draft a Deck"),
        )}
        maxWidthClass="max-w-6xl"
      >
        <p className={cn("mt-3 text-center", bodyTextClass)}>
          {i18n.displayText(
            isComplete
              ? i18n.text("ui.draft-deck-screen.d3", "You drafted {{value0}} cards. Ready to begin your run.", {
                  value0: i18n.displayText(String(draftedCards.length)),
                })
              : i18n.text("ui.draft-deck-screen.d4", "Pick 1 of 3 cards - {{value0}}/{{value1}} selected", {
                  value0: i18n.displayText(String(round)),
                  value1: i18n.displayText(String(DRAFT_ROUNDS)),
                }),
          )}
        </p>

        <div className="mx-auto mt-4 w-full">
          {isComplete ? (
            <div className="mx-auto grid max-w-fit grid-cols-3 justify-items-center gap-6">
              {draftedCards.map((card, index) => {
                const itemKey = `drafted-${card.id}-${String(card.uid ?? index)}`;
                return (
                  <DraftedCardItem
                    key={itemKey}
                    card={card}
                    interactionKey={itemKey}
                    onHoverChange={(hovered) => setHoveredCard(hovered ? card : null)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-center gap-6">
              {draftChoices.map((card, index) => (
                <SelectableCard
                  key={`draft-choice-${card.id}-${String(card.uid ?? index)}`}
                  card={card}
                  isSelected={false}
                  shineColor={getCardInspectionShineColors(card)}
                  onSelect={() => onPick(card.id)}
                  interactionKey={`draft-choice-${String(index)}`}
                  onHoverChange={(hovered) => setHoveredCard(hovered ? card : null)}
                />
              ))}
            </div>
          )}
        </div>

        {isComplete ? (
          <div className="mt-6 flex justify-center">
            <Button size="lg" variant="primary" className="min-w-56" onClick={() => onComplete()}>
              {i18n.text("ui.draft-deck-screen.1", "Continue")}
            </Button>
          </div>
        ) : null}
      </TitledScreenShell>
    </FadeSlot>
  );
}
