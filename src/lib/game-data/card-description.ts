import { companionLibrary, type CompanionDamageModifiers } from "./companions";
import { getCompanionDescriptionLines } from "./cards/companion-turn-description";
import { DAMAGE_TYPES, type BattleCard, type BattleCardEffect } from "./types";

export interface CardDescriptionContext {
  flatPhysicalDamage?: number;
  companionDamage?: number;
  companionDamageBonus?: number;
  companionDamageBuff?: number;
  companionDamageModifiers?: CompanionDamageModifiers;
  companionBondLevels?: Record<string, number>;
  potionPotency?: number;
  reactionPreview?: { shatter: string | null; wildfire: string | null };
}

export function getEffectiveCardDescriptionLines(
  card: Pick<BattleCard, "id" | "effects" | "descriptionLines" | "brewed">,
  context: CardDescriptionContext = {},
): string[] {
  const summon = card.effects.find((effect) => effect.kind === "summon-companion");
  if (summon) {
    // Catalog summon cards carry [companionLine, "Companion"]. Malformed saves
    // may not — preserve any trailing lines but always keep the tag.
    const trailing = card.descriptionLines.slice(1).filter((line) => line !== "Companion");
    return [
      ...getCompanionDescriptionLines(
        companionLibrary[summon.companionId],
        context.companionBondLevels?.[summon.companionId] ?? 0,
        context.companionDamageModifiers ??
          (context.companionDamage ?? 0) + (context.companionDamageBonus ?? 0) + (context.companionDamageBuff ?? 0),
      ),
      ...trailing,
      "Companion",
    ];
  }
  const lines = [...card.descriptionLines];
  if (card.brewed) lines.push("Brewed: cannot be brewed again");
  if (context.reactionPreview) {
    const types = new Set<string>();
    let conditional = false;
    function collect(effects: readonly BattleCardEffect[]) {
      for (const effect of effects) {
        if (effect.kind === "chance") {
          conditional = true;
          collect(effect.successEffects);
          collect(effect.failureEffects);
        } else if (effect.kind === "damage") {
          if (effect.damageTypePool) {
            conditional = true;
            effect.damageTypePool.forEach((type) => types.add(type));
          } else types.add(effect.damageType);
          if (effect.damageTypeIfTargetFrozen) {
            conditional = true;
            types.add(effect.damageTypeIfTargetFrozen);
          }
          if (effect.damageTypeIfTargetHasBlock) {
            conditional = true;
            types.add(effect.damageTypeIfTargetHasBlock);
          }
        } else if (effect.kind === "random-damage") {
          conditional = true;
          (effect.damageTypePool ?? DAMAGE_TYPES).forEach((type) => types.add(type));
        }
        // Scheduled pulses cannot initiate reactions and are deliberately not traversed.
      }
    }
    collect(card.effects);
    if (types.has("physical") && context.reactionPreview.shatter)
      lines.push(`${conditional ? "If the Physical hit resolves: " : ""}${context.reactionPreview.shatter}`);
    if (types.has("nature") && context.reactionPreview.wildfire)
      lines.push(`${conditional ? "If the Nature hit resolves: " : ""}${context.reactionPreview.wildfire}`);
  }
  return lines;
}
