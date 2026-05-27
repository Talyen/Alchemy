import { cn } from "@/lib/utils";
import { type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { Button } from "@/components/ui/button";
import { DetailPopup } from "../../ui/card-ui";
import { DisabledTooltip } from "../../ui/shared-ui";
import { StarRating } from "../../ui/star-rating";
import { TiltSurface } from "../../ui/tilt-surface";
import { type BattleCard, type CompanionId } from "@/lib/game-data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "../../use-homestead-state";
import { getEffectiveCardDescriptionLines } from "../../utils/card-description";
import { HOMESTEAD_CONFIG, MaterialCost } from "./helpers";

export function CompanionCardNode({
  card,
  index,
  discovered,
  bondedCompanions,
  materialInventory,
  hoveredItemId,
  setHoveredItemId,
  onBond,
}: {
  card: BattleCard;
  index: number;
  discovered: boolean;
  bondedCompanions: Record<CompanionId, number>;
  materialInventory: MaterialInventory;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  onBond: (card: BattleCard) => void;
}) {
  const companionEffect = card.effects.find(
    (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
  );
  const companionId = companionEffect?.companionId ?? null;
  const currentLevel = companionId ? (bondedCompanions[companionId] ?? 0) : 0;
  const isComplete = currentLevel >= COMPANION_MAX_TIER;
  const bondCost = COMPANION_BOND_TIERS[Math.min(currentLevel, COMPANION_MAX_TIER - 1)];
  const bondAffordable = discovered && !isComplete && canAfford(materialInventory, bondCost);
  const showButton = discovered && !isComplete;

  return (
    <div
      className={cn("flex flex-col items-center relative", index < HOMESTEAD_CONFIG.compilationFillerCount && "mb-2")}
      onMouseEnter={() => setHoveredItemId(card.id)}
      onMouseLeave={() => setHoveredItemId(null)}
    >
      {hoveredItemId === card.id && (
        <DetailPopup
          idPrefix={card.id}
          title={discovered ? card.title : "Undiscovered"}
          subtitle={undefined}
          descriptionLines={
            discovered
              ? getEffectiveCardDescriptionLines(card, {
                  companionBondLevels: bondedCompanions,
                })
              : ["Discover this card during a run to reveal it here."]
          }
        />
      )}
      <div className="group w-full overflow-hidden rounded-[18px] p-3">
        <TiltSurface
          className={cn(
            "relative mx-auto flex items-center justify-center overflow-hidden rounded-[18px] bg-stone-900",
            HOMESTEAD_CONFIG.companionPageWidth,
            HOMESTEAD_CONFIG.companionAspectRatio,
            isComplete && "bg-stone-800/70",
          )}
        >
          <img
            src={card.art}
            alt={card.title}
            className={cn("h-full w-full object-cover", !discovered && "grayscale opacity-45")}
          />
        </TiltSurface>
      </div>
      {showButton ? (
        <div className="mt-1.5 flex items-center gap-2">
          <DisabledTooltip show={!bondAffordable} message="Not Enough Resources">
            <Button variant="outline" disabled={!bondAffordable} onClick={() => onBond(card)}>
              {card.title}
              <MaterialCost material="food" amount={bondCost.food} />
            </Button>
          </DisabledTooltip>
          <StarRating current={currentLevel} max={COMPANION_MAX_TIER} />
        </div>
      ) : (
        <div className="mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75">
          <span>{discovered ? card.title : "Undiscovered"}</span>
          {discovered && <StarRating current={COMPANION_MAX_TIER} max={COMPANION_MAX_TIER} />}
        </div>
      )}
    </div>
  );
}
