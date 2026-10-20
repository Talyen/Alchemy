import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { useGameTranslation } from "@/components/use-game-translation";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import { gearDefinitionId, gearDefinitions, getGearDefinitionShineColors, getUniqueItemDefinition } from "@/lib/gear";
import type { MaterialId } from "@/lib/homestead/types";
import { sortMysteryEffectsByDisplayOrder, type MysteryEffect } from "@/lib/mystery";
import { cn, formatLargeAmount } from "@/lib/utils";
import {
  cardSurfaceClass,
  controlLabelClass,
  gearArtAspectClass,
  gearArtFillClass,
  viewCardWidthClass,
  keywordIcons,
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
    <div className={cn("flex flex-col items-center gap-3", viewCardWidthClass)}>
      <InteractiveArtTile
        as="button"
        id={definition.id}
        interactionKey={interactionKey}
        title={i18n.displayText(definition.displayName)}
        art={definition.art}
        className={cn(cardSurfaceClass, viewCardWidthClass, gearArtAspectClass)}
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

function MysteryKeywordXPGain({ effect }: { effect: Extract<MysteryEffect, { kind: "gainXP" }> }) {
  const i18n = useGameTranslation();
  const keyword = keywordDefinitions[effect.keyword];
  const Icon = keywordIcons[effect.keyword];
  return (
    <div className="flex min-h-[calc(64px*var(--content-scale,1))] min-w-[calc(160px*var(--content-scale,1))] items-center gap-3.5 rounded-xl border border-border/60 bg-card/65 px-5 py-3 shadow-sm backdrop-blur-sm">
      <Icon aria-hidden="true" className={cn("h-12 w-12 shrink-0", keyword.colorClass)} />
      <div className="flex min-w-0 flex-col text-left leading-tight">
        <span className="text-base font-medium tracking-wide text-muted-foreground uppercase">
          {i18n.text("mystery.keyword-xp-label", "{{keyword}} XP", { keyword: i18n.displayText(keyword.label) })}
        </span>
        <span className="text-xl font-bold text-foreground tabular-nums">
          +{formatLargeAmount(effect.amount, i18n.locale)}
        </span>
      </div>
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
    <div className="flex flex-1 flex-col items-center justify-between gap-4">
      <div className="flex flex-wrap items-start justify-center gap-6">
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
      <div className="flex w-full flex-wrap items-center justify-center gap-3">
        <FoundResourcesRow gold={gold} materials={materials} size="lg" className="w-auto" />
        {effects
          .filter((effect) => effect.kind === "gainXP")
          .map((effect, index) => (
            <MysteryKeywordXPGain key={index} effect={effect} />
          ))}
      </div>
    </div>
  );
}
