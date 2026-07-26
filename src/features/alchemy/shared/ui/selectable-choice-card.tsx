// Selectable BattleCard choice tile — shared draft / reward card chrome (selected ring + hover).
import type { BattleCard } from "@/lib/game-data";

import { collectionTileWidthClass } from "@/features/alchemy/shared/config";

import { BattleCardButton } from "./card-button";
import { getCardDisplayTitle } from "./card-description-ui";
import { useInteractiveCard } from "./use-interactive-card";

export function SelectableChoiceCard({
  card,
  selected,
  onSelect,
  interactionKey,
}: {
  card: BattleCard;
  selected: boolean;
  onSelect: () => void;
  /** Namespace for hover/shimmer identity (e.g. "reward", "draft-choice-0"). */
  interactionKey: string;
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
      className={collectionTileWidthClass}
      wrapperClassName="relative flex justify-center"
    />
  );
}
