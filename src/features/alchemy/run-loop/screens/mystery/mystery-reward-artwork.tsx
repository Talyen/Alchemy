import { useGameTranslation } from "@/components/use-game-translation";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";
import {
  cardInteractiveGlowClass,
  controlLabelClass,
  getCardInspectionShineColors,
  viewCardWidthClass,
} from "@/features/alchemy/shared/config";
import { BattleCardButton } from "../../../shared/ui/cards/card-button";
import { CardTitle, getCardDisplayTitle } from "../../../shared/ui/cards/card-description-ui";
import { GearTile, TrinketTile } from "../../../shared/ui/collection-art-tiles";
import { GearItemTitle, TrinketItemTitle } from "../../../shared/ui/gear-item-title";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";

export function MysteryCardRewardItem({
  card,
  interactionKey = "mystery-reward",
}: {
  card: BattleCard;
  interactionKey?: string;
}) {
  const i18n = useGameTranslation();
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    interactionKey,
    card.id,
  );

  return (
    <div className={cn("flex flex-col items-center gap-3", viewCardWidthClass)}>
      <BattleCardButton
        card={card}
        hovered={isHovered}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        ariaLabel={i18n.read(() => getCardDisplayTitle(card))}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shineColor={getCardInspectionShineColors(card)}
        className={cn(viewCardWidthClass, cardInteractiveGlowClass)}
      />
      <p className={controlLabelClass}>
        <CardTitle card={card} />
      </p>
    </div>
  );
}

export function MysteryEquipmentRewardItem({
  item,
  interactionKey = "mystery-reward",
}: {
  item: TrinketEntry | GearInstance;
  interactionKey?: string;
}) {
  useGameTranslation();
  const gear = "instanceId" in item;
  return (
    <div className={cn("flex flex-col items-center gap-3", viewCardWidthClass)}>
      {gear ? (
        <GearTile instance={item} interactionKey={interactionKey} className={viewCardWidthClass} />
      ) : (
        <TrinketTile
          trinket={item}
          interactionKey={interactionKey}
          as="button"
          className={viewCardWidthClass}
          temporary
        />
      )}
      <p className={controlLabelClass}>
        {gear ? <GearItemTitle instance={item} /> : <TrinketItemTitle trinket={item} />}
      </p>
    </div>
  );
}
