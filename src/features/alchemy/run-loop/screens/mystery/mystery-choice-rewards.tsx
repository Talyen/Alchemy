import { useGameTranslation } from "@/components/use-game-translation";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import { gearDefinitionId, gearDefinitions, getGearDefinitionShineColors, getUniqueItemDefinition } from "@/lib/gear";
import type { MaterialId } from "@/lib/homestead/types";
import { sortMysteryEffectsByDisplayOrder, type MysteryEffect } from "@/lib/mystery";
import { cn } from "@/lib/utils";
import {
  cardSurfaceClass,
  controlLabelClass,
  gearArtAspectClass,
  gearArtFillClass,
  getTileWidthClass,
} from "@/features/alchemy/shared/config";
import { FoundResourcesRow } from "../../../shared/ui/found-resources-row";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { InteractiveArtTile } from "../../../shared/ui/interactive-art-tile";
import { PortaledTooltip } from "../../../shared/ui/tooltips/portaled-tooltip";
import { GearTooltipContent } from "../../../shared/ui/tooltips/gear-tooltip-content";
import { MysteryEffectBadge } from "./mystery-effect-badge";
import { MysteryCardRewardItem, MysteryEquipmentRewardItem } from "./mystery-reward-artwork";

function MysteryGearPreview({
  effect,
  interactionKey,
}: {
  effect: Extract<MysteryEffect, { kind: "gainGeneratedGear" }>;
  interactionKey: string;
}) {
  const i18n = useGameTranslation();
  const unique = getUniqueItemDefinition(effect.baseItemId);
  const definition =
    gearDefinitions[unique ? unique.id : gearDefinitionId(effect.baseItemId, effect.astral ? "astral" : "basic")];
  if (!definition) return <MysteryEffectBadge effect={effect} />;

  return (
    <div className="flex flex-col items-center gap-3">
      <InteractiveArtTile
        as="button"
        id={definition.id}
        interactionKey={interactionKey}
        title={i18n.displayText(definition.displayName)}
        art={definition.art}
        className={cn(cardSurfaceClass, getTileWidthClass("collection"), gearArtAspectClass)}
        imageClassName={gearArtFillClass}
        shineOnHover
        shineColor={getGearDefinitionShineColors(definition)}
        popup={({ visible, triggerRef }) => (
          <PortaledTooltip triggerRef={triggerRef} visible={visible}>
            <GearTooltipContent definition={definition} />
            <p className="mt-3 text-sm text-muted-foreground">
              {i18n.text("mystery.gear-preview-rolls", "Gear effects are rolled after choosing.")}
            </p>
          </PortaledTooltip>
        )}
      />
      <p className={controlLabelClass}>
        <GearItemTitle definition={definition} />
      </p>
    </div>
  );
}

export function MysteryChoiceRewards({
  effects,
  interactionKey,
  findCard,
  findTrinket,
}: {
  effects: MysteryEffect[];
  interactionKey: string;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}) {
  useGameTranslation();
  let gold = 0;
  const materials: Partial<Record<MaterialId, number>> = {};
  for (const effect of effects) {
    if (effect.kind === "gainGold") gold += effect.amount;
    if (effect.kind === "gainMaterial") materials[effect.material] = (materials[effect.material] ?? 0) + effect.amount;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-4">
      <div className="flex flex-wrap items-end justify-center gap-6">
        {sortMysteryEffectsByDisplayOrder(effects).map((effect, index) => {
          switch (effect.kind) {
            case "addCard": {
              const card = findCard(effect.cardId);
              return card ? (
                <MysteryCardRewardItem key={index} card={card} interactionKey={`${interactionKey}:${index}`} />
              ) : (
                <MysteryEffectBadge key={index} effect={effect} findCard={findCard} />
              );
            }
            case "gainTrinket": {
              const trinket = findTrinket(effect.trinketId);
              return trinket ? (
                <MysteryEquipmentRewardItem key={index} item={trinket} interactionKey={`${interactionKey}:${index}`} />
              ) : (
                <MysteryEffectBadge key={index} effect={effect} findTrinket={findTrinket} />
              );
            }
            case "gainGeneratedGear":
              return <MysteryGearPreview key={index} effect={effect} interactionKey={`${interactionKey}:${index}`} />;
            case "gainGold":
            case "gainMaterial":
            case "gainXP":
              return null;
            case "chooseCard":
            case "gainRandomGear":
            case "healHealth":
              return <MysteryEffectBadge key={index} effect={effect} findCard={findCard} findTrinket={findTrinket} />;
          }
        })}
      </div>
      <FoundResourcesRow gold={gold} materials={materials} size="lg" />
      {effects
        .filter((effect) => effect.kind === "gainXP")
        .map((effect, index) => (
          <MysteryEffectBadge key={index} effect={effect} />
        ))}
    </div>
  );
}
