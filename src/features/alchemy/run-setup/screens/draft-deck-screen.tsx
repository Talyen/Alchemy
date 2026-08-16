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
import { TitledScreenShell } from "../../shared/ui/shared-ui";
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
      tiltEnabled={false}
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
  onOpenMenu: (rect?: DOMRect) => void;
}

export function DraftDeckScreen({ onComplete, draftedCards, draftChoices, onPick, onOpenMenu }: Props) {
  const [localDrafted, setLocalDrafted] = useState<BattleCard[]>([]);
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
    <TitledScreenShell
      title={isComplete ? "Draft Complete" : "Draft a Deck"}
      onOpenMenu={onOpenMenu}
      menuLabel="Open draft menu"
      maxWidthClass="max-w-6xl"
    >
      <p className={cn("mt-3 text-center", bodyTextClass)}>
        {isComplete
          ? "You drafted " + String(drafted.length) + " cards. Ready to begin your run."
          : "Pick 1 of 3 cards \u2014 " + String(round + 1) + "/" + String(DRAFT_ROUNDS) + " selected"}
      </p>

      <FadeSlot swapKey={isComplete ? "complete" : round} className="mx-auto mt-8 min-h-[36cqh] w-full">
        {isComplete ? (
          <div className="mx-auto grid max-w-fit grid-cols-3 justify-items-center gap-6">
            {drafted.map((card, index) => (
              <DraftedCardItem key={"drafted-" + String(index) + "-" + card.id} card={card} index={index} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-center gap-6">
            {choices.map((card, index) => (
              <SelectableChoiceCard
                key={"draft-choice-" + String(index) + "-" + card.id}
                card={card}
                onSelect={() => handlePick(card)}
                interactionKey={"draft-choice-" + String(index)}
                tiltEnabled={false}
              />
            ))}
          </div>
        )}
      </FadeSlot>

      {isComplete ? (
        <div className="mt-8 flex justify-center">
          <Button size="lg" variant="primary" className={BUTTON_WIDTH_ACTION} onClick={() => onComplete(drafted)}>
            Continue
          </Button>
        </div>
      ) : null}
    </TitledScreenShell>
  );
}
