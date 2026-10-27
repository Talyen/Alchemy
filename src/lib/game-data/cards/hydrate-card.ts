import { isCompanionSummonCard } from "./card-pools";
import { CONSUME_DESCRIPTION_LINE, TRANSMUTATION_PREFIXES } from "@/lib/game-constants";
import type { BattleCard } from "../types";
import { cardById } from "./library/cards";
import { mapCardDescriptionReferences } from "../card-description-model";
import { mapEffectChildren } from "../effect-tree";

export type SavedCard = BattleCard;

function cloneEffect(effect: BattleCard["effects"][number]): BattleCard["effects"][number] {
  const mapped = mapEffectChildren(effect, cloneEffect, false);
  if ((effect.kind === "damage" || effect.kind === "random-damage") && effect.damageTypePool) {
    return { ...effect, damageTypePool: [...effect.damageTypePool] };
  }
  if (effect.kind === "player-status" && effect.statusPool) {
    return { ...effect, statusPool: [...effect.statusPool] };
  }
  return { ...mapped };
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
    ...(card.description
      ? {
          description: mapCardDescriptionReferences(card.description, (reference) => reference),
        }
      : {}),
    ...(card.tags ? { tags: [...card.tags] } : {}),
  };
}

export function hydrateCard(savedCard: SavedCard): BattleCard {
  const libraryCard = Object.hasOwn(cardById, savedCard.id) ? cardById[savedCard.id] : undefined;
  if (!libraryCard) {
    return cloneBattleCard(savedCard);
  }

  const keepSavedContent =
    savedCard.effects.length > 0 &&
    savedCard.descriptionLines.length > 0 &&
    savedCard.descriptionLines.every((line) => typeof line === "string");
  const content = keepSavedContent ? savedCard : libraryCard;
  const { consume: catalogConsume, description: _catalogDescription, ...catalogMetadata } = libraryCard;
  // Missing Consume meant reusable in complete saved content, even if the catalog now Consumes.
  const hiddenSummonConsume =
    isCompanionSummonCard(content) &&
    !content.descriptionLines.includes(CONSUME_DESCRIPTION_LINE) &&
    !content.description?.some((line) => line.role === "consume");
  const consume = hiddenSummonConsume
    ? undefined
    : (savedCard.consume ?? (keepSavedContent ? undefined : catalogConsume));

  return cloneBattleCard({
    ...catalogMetadata,
    descriptionLines: content.descriptionLines,
    effects: content.effects,
    ...(content.description ? { description: content.description } : {}),
    cost: hydrateCost(savedCard, libraryCard),
    ...(consume !== undefined && { consume }),
    ...(savedCard.uid !== undefined && { uid: savedCard.uid }),
    ...(keepSavedContent && savedCard.corrupted !== undefined && { corrupted: savedCard.corrupted }),
    ...(keepSavedContent &&
      savedCard.transmuted && {
        transmuted: savedCard.transmuted,
        title: `${TRANSMUTATION_PREFIXES[savedCard.transmuted]} ${savedCard.baseTitle ?? libraryCard.title}`,
      }),
    ...(keepSavedContent && savedCard.tags && { tags: savedCard.tags }),
    ...(keepSavedContent && savedCard.baseTitle !== undefined && { baseTitle: savedCard.baseTitle }),
  });
}
