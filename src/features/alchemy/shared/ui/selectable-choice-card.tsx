// Selectable BattleCard choice tile — shared draft / reward card chrome (selected ring + hover).
import type { BattleCard } from "@/lib/game-data";

import { cardInteractiveGlowClass, collectionTileWidthClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

import { BattleCardButton } from "./card-button";
import { getCardDisplayTitle } from "./card-description-ui";
import { useInteractiveCard } from "./use-interactive-card";

export function SelectableChoiceCard({
  card,
  selected = false,
  onSelect,
  interactionKey,
  tiltEnabled = true,
}: {
  card: BattleCard;
  selected?: boolean;
  onSelect: () => void;
  /** Namespace for hover/shimmer identity (e.g. "reward", "draft-choice-0"). */
  interactionKey: string;
  tiltEnabled?: boolean;
}) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    interactionKey,
    card.id,
  );

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={onSelect}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      selected={selected}
      tiltEnabled={tiltEnabled}
      className={cn(collectionTileWidthClass, cardInteractiveGlowClass)}
      wrapperClassName="relative flex justify-center"
    />
  );
}
