// Rehydrates a saved card against the library entry. Re-exported by ../cards.
import type { BattleCard } from "../types";
import { cardLibrary } from "../cards";

export type SavedCard = BattleCard & {
  descriptionLinesFullyValid?: boolean;
  effectsFullyValid?: boolean;
};

function hydrateDescriptionLines(saved: SavedCard, libraryCard: BattleCard): string[] {
  if (Array.isArray(saved.descriptionLines) && saved.descriptionLinesFullyValid !== false)
    return [...saved.descriptionLines];
  return [...libraryCard.descriptionLines];
}

function hydrateEffects(saved: SavedCard, libraryCard: BattleCard): BattleCard["effects"] {
  if (Array.isArray(saved.effects) && saved.effectsFullyValid !== false)
    return saved.effects.map((e) => (typeof e === "object" ? { ...e } : e));
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip save-only validity flags
    const { descriptionLinesFullyValid, effectsFullyValid, ...rest } = savedCard;
    return rest;
  }

  const saved = savedCard;
  const corruptedValuePositions =
    Array.isArray(saved.corruptedValuePositions) && saved.corruptedValuePositions.length > 0
      ? saved.corruptedValuePositions
      : undefined;

  return {
    ...libraryCard,
    descriptionLines: hydrateDescriptionLines(saved, libraryCard),
    effects: hydrateEffects(saved, libraryCard),
    cost: hydrateCost(saved, libraryCard),
    ...(pickOptionalField<boolean>(saved, "consume") !== undefined && { consume: saved.consume }),
    ...(pickOptionalField<boolean>(saved, "corrupted") !== undefined && { corrupted: saved.corrupted }),
    ...(pickOptionalField<string>(saved, "baseTitle") !== undefined && { baseTitle: saved.baseTitle }),
    ...(pickOptionalField<string>(saved, "uid") !== undefined && { uid: saved.uid }),
    ...(corruptedValuePositions && { corruptedValuePositions }),
  };
}
