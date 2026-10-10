import { companionLibrary, type CompanionDamageModifiers } from "./companions";
import { getCompanionDescriptionLines } from "./cards/companion-turn-description";
import type { BattleCard } from "./types";

export interface CardDescriptionContext {
  companionDamageModifiers?: CompanionDamageModifiers;
  companionBondLevels?: Record<string, number>;
}

export function getEffectiveCardDescriptionLines(
  card: Pick<BattleCard, "id" | "effects" | "descriptionLines">,
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
        context.companionDamageModifiers ?? 0,
      ),
      ...trailing,
      "Companion",
    ];
  }
  return [...card.descriptionLines];
}
