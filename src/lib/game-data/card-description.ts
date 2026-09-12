import { companionLibrary, type CompanionDamageModifiers } from "./companions";
import { getCompanionDescriptionLines } from "./cards/companion-turn-description";
import type { BattleCard } from "./types";

export interface CardDescriptionContext {
  flatPhysicalDamage?: number;
  companionDamage?: number;
  companionDamageBonus?: number;
  companionDamageBuff?: number;
  companionDamageModifiers?: CompanionDamageModifiers;
  companionBondLevels?: Record<string, number>;
  potionPotency?: number;
}

export function getEffectiveCardDescriptionLines(
  card: Pick<BattleCard, "id" | "effects" | "descriptionLines">,
  context: CardDescriptionContext = {},
): string[] {
  const summon = card.effects.find((effect) => effect.kind === "summon-companion");
  if (summon) {
    return [
      ...getCompanionDescriptionLines(
        companionLibrary[summon.companionId],
        context.companionBondLevels?.[summon.companionId] ?? 0,
        context.companionDamageModifiers ??
          (context.companionDamage ?? 0) + (context.companionDamageBonus ?? 0) + (context.companionDamageBuff ?? 0),
      ),
      ...card.descriptionLines.slice(1),
    ];
  }
  return [...card.descriptionLines];
}
