// Rehydrates a saved card against the library entry. Re-exported by ../cards.
import type { BattleCard } from "../types";
import { cardLibrary } from "../cards";

export type SavedCard = BattleCard;

function hydrateDescriptionLines(saved: SavedCard, libraryCard: BattleCard): string[] {
  if (Array.isArray(saved.descriptionLines) && saved.descriptionLines.length > 0) {
    return [...saved.descriptionLines];
  }
  return [...libraryCard.descriptionLines];
}

function hydrateEffects(saved: SavedCard, libraryCard: BattleCard): BattleCard["effects"] {
  if (Array.isArray(saved.effects) && saved.effects.length > 0) {
    return saved.effects.map((e) => (typeof e === "object" ? { ...e } : e));
  }
  return libraryCard.effects.map((e) => ({ ...e }));
}

function hydrateCost(saved: SavedCard, libraryCard: BattleCard): number {
  if (typeof saved.cost === "number" && Number.isFinite(saved.cost) && saved.cost >= 0) return Math.round(saved.cost);
  return libraryCard.cost;
}

function pickOptionalField<T>(saved: SavedCard, key: keyof SavedCard): T | undefined {
  return saved[key] !== undefined ? (saved[key] as T) : undefined;
}

export function hydrateCard(savedCard: SavedCard): BattleCard {
  const libraryCard = cardLibrary.find((c) => c.id === savedCard.id);
  if (!libraryCard) {
    // E2E / custom cards with no library entry — keep the saved shape as-is.
    return savedCard;
  }

  const corruptedValuePositions =
    Array.isArray(savedCard.corruptedValuePositions) && savedCard.corruptedValuePositions.length > 0
      ? savedCard.corruptedValuePositions
      : undefined;

  return {
    ...libraryCard,
    descriptionLines: hydrateDescriptionLines(savedCard, libraryCard),
    effects: hydrateEffects(savedCard, libraryCard),
    cost: hydrateCost(savedCard, libraryCard),
    ...(pickOptionalField<boolean>(savedCard, "consume") !== undefined && { consume: savedCard.consume }),
    ...(pickOptionalField<boolean>(savedCard, "corrupted") !== undefined && { corrupted: savedCard.corrupted }),
    ...(pickOptionalField<string>(savedCard, "baseTitle") !== undefined && { baseTitle: savedCard.baseTitle }),
    ...(pickOptionalField<string>(savedCard, "uid") !== undefined && { uid: savedCard.uid }),
    ...(corruptedValuePositions && { corruptedValuePositions }),
  };
}
