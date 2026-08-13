import { useCallback, useMemo, useState } from "react";
import type { BattleCard } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { selectRewardCards } from "@/lib/game-data";
import { DRAFT_ROUNDS, DRAFT_CHOICES } from "@/lib/game-constants";

import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION, bodyTextClass, collectionTileWidthClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { BattleCardButton } from "../../shared/ui/card-button";
import { getCardDisplayTitle } from "../../shared/ui/card-description-ui";
import { SelectableChoiceCard } from "../../shared/ui/selectable-choice-card";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { ScreenHeader } from "../../shared/ui/shared-ui";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

function DraftedCardItem({ card, index }: { card: BattleCard; index: number }) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    "drafted-" + String(index),
    card.id,
  );

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      ariaLabel={getCardDisplayTitle(card)}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      className={collectionTileWidthClass}
      wrapperClassName="relative flex justify-center"
    />
  );
}

interface Props {
  onComplete: (draftedCards: BattleCard[]) => void;
  draftedCards?: BattleCard[];
  draftChoices?: BattleCard[];
  onPick?: (card: BattleCard) => void;
}

export function DraftDeckScreen({ onComplete, draftedCards, draftChoices, onPick }: Props) {
  const [localDrafted, setLocalDrafted] = useState<BattleCard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const drafted = draftedCards ?? localDrafted;
  const round = drafted.length;

  const localChoices = useMemo(() => {
    return selectRewardCards(drafted, getOfferableCardPool(), DRAFT_CHOICES, drafted);
  }, [drafted]);
  const choices = draftChoices ?? localChoices;

  const handlePick = useCallback(
    (card: BattleCard) => {
      const nextDrafted = [...drafted, card];
      if (onPick) onPick(card);
      else setLocalDrafted(nextDrafted);
    },
    [drafted, onPick],
  );

  const isComplete = drafted.length >= DRAFT_ROUNDS;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div className="alchemy-shell flex w-full max-w-6xl flex-col items-center rounded-shell-hero border border-border/80 p-7">
        <ScreenHeader title={isComplete ? "Draft Complete" : "Draft a Deck"} />
        <p className={cn("mt-3", bodyTextClass)}>
          {isComplete
            ? "You drafted " + String(drafted.length) + " cards. Ready to begin your run."
            : "Pick 1 of 3 cards \u2014 " + String(round + 1) + "/" + String(DRAFT_ROUNDS) + " selected"}
        </p>

        {isComplete ? (
          <FadeSlot
            swapKey="draft-complete"
            className="mx-auto mt-8 grid max-w-fit grid-cols-3 justify-items-center gap-6"
          >
            {drafted.map((card, index) => (
              <DraftedCardItem key={"drafted-" + String(index) + "-" + card.id} card={card} index={index} />
            ))}
          </FadeSlot>
        ) : (
          <FadeSlot swapKey={round} className="mt-8 flex flex-wrap items-start justify-center gap-6">
            {choices.map((card, index) => (
              <SelectableChoiceCard
                key={"draft-choice-" + String(index) + "-" + card.id}
                card={card}
                selected={selectedIndex === index}
                onSelect={() => setSelectedIndex(index)}
                interactionKey={"draft-choice-" + String(index)}
              />
            ))}
          </FadeSlot>
        )}

        {isComplete ? (
          <div className="mt-8">
            <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={() => onComplete(drafted)}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <Button
              size="lg"
              className={BUTTON_WIDTH_ACTION}
              disabled={selectedIndex === null}
              onClick={() => {
                if (selectedIndex === null) return;
                handlePick(choices[selectedIndex]!);
                setSelectedIndex(null);
              }}
            >
              Select Card
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
