import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { renderUnlockMessage } from "../../../shared/ui/unlock-text";
import { InteractiveArtTile, type PopupContext } from "../../../shared/ui/interactive-art-tile";
import { StarRating } from "../../../shared/ui/star-rating";
import { type BattleCard, type CompanionId, getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { cardSurfaceClass, collectionCardGridTileWidthClass, cardArtImageClass } from "../../../shared/config";
import { HOMESTEAD_CONFIG, formatMaterialCostSummary } from "./helpers";
import {
  HomesteadTooltipCost,
  homesteadCompletedSurfaceClass,
  homesteadUndiscoveredDimClass,
} from "./homestead-tile-node";
import { getPlasmaColorPairForCard } from "@/features/alchemy/shared/config";

function getCompanionTooltip(
  card: BattleCard,
  discovered: boolean,
  currentLevel: number,
  bondedCompanions: Record<CompanionId, number>,
  bondCost: MaterialInventory | undefined,
  materialInventory: MaterialInventory,
): (ctx: PopupContext) => ReactNode {
  const title = discovered ? (
    <span className="inline-flex items-center gap-2">
      {card.title}
      <StarRating current={currentLevel} max={COMPANION_MAX_TIER} className="h-3.5 w-3.5" />
    </span>
  ) : (
    "Undiscovered"
  );

  const showCost =
    discovered && currentLevel < COMPANION_MAX_TIER && bondCost && MATERIAL_IDS.some((m) => (bondCost[m] ?? 0) > 0);

  return ({ visible, triggerRef }) => (
    <DetailPopup
      idPrefix={card.id}
      title={title}
      subtitle={undefined}
      descriptionLines={
        visible && discovered ? getEffectiveCardDescriptionLines(card, { companionBondLevels: bondedCompanions }) : []
      }
      descriptionNodes={
        visible && !discovered
          ? [<p key="undiscovered">{renderUnlockMessage("Discover this Companion during a Run to reveal it here.")}</p>]
          : showCost && bondCost
            ? [<HomesteadTooltipCost key="cost" label="Bond" cost={bondCost} inventory={materialInventory} />]
            : undefined
      }
      visible={visible}
      triggerRef={triggerRef}
      plasmaColorPair={discovered ? getPlasmaColorPairForCard(card) : null}
    />
  );
}

export function CompanionCardNode({
  card,
  discovered,
  bondedCompanions,
  materialInventory,
  onBond,
}: {
  card: BattleCard;
  discovered: boolean;
  bondedCompanions: Record<CompanionId, number>;
  materialInventory: MaterialInventory;
  onBond: (card: BattleCard) => void;
}) {
  const companionEffect = card.effects.find(
    (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
  );
  const companionId = companionEffect?.companionId ?? null;
  const currentLevel = companionId ? (bondedCompanions[companionId] ?? 0) : 0;
  const isComplete = currentLevel >= COMPANION_MAX_TIER;
  const bondTierIndex = Math.min(currentLevel, COMPANION_MAX_TIER - 1);
  const bondCost = COMPANION_BOND_TIERS[bondTierIndex];
  const bondAffordable = Boolean(bondCost) && discovered && !isComplete && canAfford(materialInventory, bondCost!);

  const detailTooltip = getCompanionTooltip(
    card,
    discovered,
    currentLevel,
    bondedCompanions,
    bondCost,
    materialInventory,
  );
  const interactive = discovered && !isComplete && Boolean(bondCost);

  const costSummary = bondCost ? formatMaterialCostSummary(bondCost) : "";
  const ariaLabel = !discovered
    ? "Undiscovered companion"
    : isComplete
      ? `${card.title}, max bond`
      : `Bond ${card.title}, level ${currentLevel} of ${COMPANION_MAX_TIER}${costSummary ? `, costs ${costSummary}` : ""}`;

  return (
    <InteractiveArtTile
      id={card.id}
      interactionKey={HOMESTEAD_CONFIG.hoverScope}
      title={card.title}
      art={card.art}
      className={cn(cardSurfaceClass, collectionCardGridTileWidthClass, isComplete && homesteadCompletedSurfaceClass)}
      imageClassName={cn(
        "block w-full transition duration-300",
        cardArtImageClass,
        !discovered && homesteadUndiscoveredDimClass,
      )}
      popup={detailTooltip}
      as={interactive ? "button" : "div"}
      showGlow={bondAffordable}
      {...(interactive ? { ariaDisabled: !bondAffordable } : {})}
      onClick={
        interactive && bondAffordable
          ? () => {
              if (discovered && !isComplete) onBond(card);
            }
          : undefined
      }
      ariaLabel={ariaLabel}
    />
  );
}
