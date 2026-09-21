import { mapEffectChildren } from "../effect-tree";
import type { BattleCard } from "../types";
import { cardById } from "./library/cards";

export type SavedCard = BattleCard;

function cloneEffect(effect: BattleCard["effects"][number]): BattleCard["effects"][number] {
  if (effect.kind === "damage" && effect.damageTypePool) {
    return { ...effect, damageTypePool: [...effect.damageTypePool] };
  }
  if (effect.kind === "random-damage" && effect.damageTypePool) {
    return { ...effect, damageTypePool: [...effect.damageTypePool] };
  }
  if (effect.kind === "player-status" && effect.statusPool) {
    return { ...effect, statusPool: [...effect.statusPool] };
  }
  return { ...mapEffectChildren(effect, cloneEffect) };
}

function hydrateCost(saved: SavedCard, libraryCard: BattleCard): number {
  if (typeof saved.cost === "number" && Number.isFinite(saved.cost) && saved.cost >= 0) return Math.round(saved.cost);
  return libraryCard.cost;
}

/**
 * Deep-enough copy of a card definition for run decks. Pool selections
 * return shared catalog objects (including nested chance/repeat effects),
 * so drafts must clone before appending or later mutations leak across runs.
 */
export function cloneBattleCard(card: BattleCard): BattleCard {
  return {
    ...card,
    descriptionLines: [...card.descriptionLines],
    effects: card.effects.map(cloneEffect),
    ...(card.tags ? { tags: [...card.tags] } : {}),
    ...(card.corruptedValuePositions ? { corruptedValuePositions: [...card.corruptedValuePositions] } : {}),
  };
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
  const { consume: catalogConsume, ...catalogMetadata } = libraryCard;
  // Missing Consume meant reusable in complete saved content, even if the catalog now Consumes.
  const consume = savedCard.consume ?? (keepSavedContent ? undefined : catalogConsume);

  return {
    ...catalogMetadata,
    descriptionLines: [...content.descriptionLines],
    effects: content.effects.map(cloneEffect),
    cost: hydrateCost(savedCard, libraryCard),
    ...(consume !== undefined && { consume }),
    ...(savedCard.uid !== undefined && { uid: savedCard.uid }),
    ...(keepSavedContent && savedCard.corrupted !== undefined && { corrupted: savedCard.corrupted }),
    ...(keepSavedContent && savedCard.baseTitle !== undefined && { baseTitle: savedCard.baseTitle }),
    ...(keepSavedContent &&
      savedCard.corruptedValuePositions?.length && {
        corruptedValuePositions: savedCard.corruptedValuePositions,
      }),
  };
}
