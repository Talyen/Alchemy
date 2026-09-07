import type { BattleCard } from "../types";
import { cardById } from "../cards";

export type SavedCard = BattleCard;

function cloneEffect(effect: BattleCard["effects"][number]): BattleCard["effects"][number] {
  if (effect.kind === "chance") {
    return {
      ...effect,
      successEffects: effect.successEffects.map(cloneEffect),
      failureEffects: effect.failureEffects.map(cloneEffect),
    };
  }
  if (effect.kind === "repeat-over-turns") {
    return { ...effect, effects: effect.effects.map(cloneEffect) };
  }
  return { ...effect };
}

function hydrateCost(saved: SavedCard, libraryCard: BattleCard): number {
  if (typeof saved.cost === "number" && Number.isFinite(saved.cost) && saved.cost >= 0) return Math.round(saved.cost);
  return libraryCard.cost;
}

export function hydrateCard(savedCard: SavedCard): BattleCard {
  const libraryCard = cardById[savedCard.id];
  if (!libraryCard) {
    return savedCard;
  }

  const keepSavedContent =
    savedCard.effects.length > 0 &&
    savedCard.descriptionLines.length > 0 &&
    savedCard.descriptionLines.every((line) => typeof line === "string");
  const content = keepSavedContent ? savedCard : libraryCard;

  return {
    ...libraryCard,
    descriptionLines: [...content.descriptionLines],
    effects: content.effects.map(cloneEffect),
    cost: hydrateCost(savedCard, libraryCard),
    ...(savedCard.consume !== undefined && { consume: savedCard.consume }),
    ...(savedCard.uid !== undefined && { uid: savedCard.uid }),
    ...(keepSavedContent && savedCard.corrupted !== undefined && { corrupted: savedCard.corrupted }),
    ...(keepSavedContent && savedCard.baseTitle !== undefined && { baseTitle: savedCard.baseTitle }),
    ...(keepSavedContent &&
      savedCard.corruptedValuePositions?.length && {
        corruptedValuePositions: savedCard.corruptedValuePositions,
      }),
  };
}
