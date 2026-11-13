import { companionLibrary, type CompanionDamageModifiers } from "./companions";
import { getCompanionDescriptionLines } from "./cards/companion-turn-description";
import type { BattleCard, CompanionId } from "./types";

export interface CardDescriptionContext {
  inspectBattleCard?: (card: BattleCard) => BattleCard;
  companionDamageModifiers?: CompanionDamageModifiers;
  companionBondLevels?: Record<string, number>;
  describeCompanion?: (id: CompanionId) => readonly string[];
}

export function getEffectiveCardDescriptionLines(
  card: Pick<BattleCard, "id" | "effects" | "descriptionLines">,
  context: CardDescriptionContext = {},
): string[] {
  const summon = card.effects.find((effect) => effect.kind === "summon-companion");
  if (summon) {
    // Catalog summon cards carry [companionLine, "Companion"]. Malformed saves
    // may not — preserve any trailing lines but always keep the tag.
    const lines = context.describeCompanion
      ? [...context.describeCompanion(summon.companionId)]
      : getCompanionDescriptionLines(
          companionLibrary[summon.companionId],
          context.companionBondLevels?.[summon.companionId] ?? 0,
          context.companionDamageModifiers ?? 0,
        );
    for (let index = 1; index < card.descriptionLines.length; index++) {
      if (index in card.descriptionLines && card.descriptionLines[index] !== "Companion") {
        lines.push(card.descriptionLines[index]!);
      }
    }
    lines.push("Companion");
    return lines;
  }
  return [...card.descriptionLines];
}
