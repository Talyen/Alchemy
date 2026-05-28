// Card library barrel — aggregates split card data modules and shared card helpers.
import { MIXED_POTION_CARD_ID, POTION_CARD_ID_SUFFIX } from "@/lib/game-constants";
import type { BattleCard } from "./types";
import { combatCards } from "./cards/combatCards";
import { supportCards } from "./cards/supportCards";

export const cardLibrary: BattleCard[] = [...combatCards, ...supportCards];

export { expectedCompanionTurnLine, formatCompanionTurnLineBase } from "./cards/companion-turn-description";

export function isStandardPotionCard(card: Pick<BattleCard, "id">): boolean {
  return card.id.endsWith(POTION_CARD_ID_SUFFIX) && card.id !== MIXED_POTION_CARD_ID;
}

/** Shop, alchemist, and reward flows share this pool (excludes generated mixed potion). */
export function getStandardPotionPool(): BattleCard[] {
  return cardLibrary.filter(isStandardPotionCard);
}

export function hydrateCard(savedCard: BattleCard): BattleCard {
  const libraryCard = cardLibrary.find((c) => c.id === savedCard.id);
  if (!libraryCard) return savedCard;

  const descriptionLines =
    Array.isArray(savedCard.descriptionLines) &&
    (savedCard as unknown as { descriptionLinesFullyValid?: boolean }).descriptionLinesFullyValid !== false
      ? [...savedCard.descriptionLines]
      : [...libraryCard.descriptionLines];

  const effects =
    Array.isArray(savedCard.effects) &&
    (savedCard as unknown as { effectsFullyValid?: boolean }).effectsFullyValid !== false
      ? (savedCard.effects.map((e) => (e && typeof e === "object" ? { ...e } : e)) as BattleCard["effects"])
      : libraryCard.effects.map((e) => ({ ...e }));

  const corruptedValuePositions = Array.isArray(savedCard.corruptedValuePositions)
    ? savedCard.corruptedValuePositions.filter(
        (p) =>
          p &&
          typeof p === "object" &&
          Number.isInteger(p.lineIndex) &&
          Number.isInteger(p.matchIndex) &&
          p.lineIndex >= 0 &&
          p.matchIndex >= 0,
      )
    : undefined;

  const cost =
    typeof savedCard.cost === "number" && Number.isFinite(savedCard.cost) && savedCard.cost >= 0
      ? Math.floor(savedCard.cost)
      : libraryCard.cost;

  const result: BattleCard = {
    ...libraryCard,
    descriptionLines,
    effects,
    cost,
  };
  if (savedCard.consume !== undefined) {
    result.consume = savedCard.consume;
  }
  if (savedCard.corrupted !== undefined) {
    result.corrupted = savedCard.corrupted;
  }
  if (savedCard.baseTitle !== undefined) {
    result.baseTitle = savedCard.baseTitle;
  }
  if (savedCard.uid !== undefined) {
    result.uid = savedCard.uid;
  }
  if (corruptedValuePositions && corruptedValuePositions.length > 0) {
    result.corruptedValuePositions = corruptedValuePositions;
  }
  return result;
}
