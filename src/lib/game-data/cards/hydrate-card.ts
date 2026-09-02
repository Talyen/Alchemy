import type { BattleCard } from "../types";
import { cardById } from "../cards";

export type SavedCard = BattleCard;

const warnedHydrateIds = new Set<string>();

function hydrateDescriptionLines(
  saved: SavedCard,
  libraryCard: BattleCard,
): { lines: string[]; usedLibraryFallback: boolean } {
  const savedLines =
    Array.isArray(saved.descriptionLines) && saved.descriptionLines.length > 0 ? saved.descriptionLines : null;
  const libraryLines = libraryCard.descriptionLines;
  if (!savedLines) return { lines: [...libraryLines], usedLibraryFallback: true };

  const savedEffects = Array.isArray(saved.effects) ? saved.effects : [];
  const libraryEffects = libraryCard.effects;
  const lengthMismatch = savedEffects.length !== libraryEffects.length;
  if (lengthMismatch) {
    if (import.meta.env.DEV && !warnedHydrateIds.has(saved.id)) {
      warnedHydrateIds.add(saved.id);
      console.warn(
        `[hydrateCard] descriptionLines fallback for ${saved.id}: saved effects ${savedEffects.length} vs library ${libraryEffects.length}`,
      );
    }
    return { lines: [...libraryLines], usedLibraryFallback: true };
  }

  if (saved.corrupted) return { lines: [...savedLines], usedLibraryFallback: false };

  if (!savedLines.every((line) => typeof line === "string"))
    return { lines: [...libraryLines], usedLibraryFallback: true };
  return { lines: [...savedLines], usedLibraryFallback: false };
}

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

function hydrateEffects(saved: SavedCard, libraryCard: BattleCard): BattleCard["effects"] {
  if (Array.isArray(saved.effects) && saved.effects.length > 0) {
    return saved.effects.map((e) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- saved.effects is untyped JSON, runtime guard needed
      typeof e === "object" ? cloneEffect(e as BattleCard["effects"][number]) : (e as BattleCard["effects"][number]),
    );
  }
  return libraryCard.effects.map(cloneEffect);
}

function hydrateCost(saved: SavedCard, libraryCard: BattleCard): number {
  if (typeof saved.cost === "number" && Number.isFinite(saved.cost) && saved.cost >= 0) return Math.round(saved.cost);
  return libraryCard.cost;
}

function pickOptionalField<T>(saved: SavedCard, key: keyof SavedCard): T | undefined {
  return saved[key] !== undefined ? (saved[key] as T) : undefined;
}

export function hydrateCard(savedCard: SavedCard): BattleCard {
  const libraryCard = cardById[savedCard.id];
  if (!libraryCard) {
    return savedCard;
  }

  const { lines: descriptionLines, usedLibraryFallback } = hydrateDescriptionLines(savedCard, libraryCard);
  const corruptedValuePositions =
    Array.isArray(savedCard.corruptedValuePositions) && savedCard.corruptedValuePositions.length > 0
      ? savedCard.corruptedValuePositions
      : undefined;
  const shouldKeepCorruptedPositions = Boolean(corruptedValuePositions) && !usedLibraryFallback;

  return {
    ...libraryCard,
    descriptionLines,
    effects: hydrateEffects(savedCard, libraryCard),
    cost: hydrateCost(savedCard, libraryCard),
    ...(pickOptionalField<boolean>(savedCard, "consume") !== undefined && { consume: savedCard.consume }),
    ...(pickOptionalField<boolean>(savedCard, "corrupted") !== undefined && { corrupted: savedCard.corrupted }),
    ...(pickOptionalField<string>(savedCard, "baseTitle") !== undefined && { baseTitle: savedCard.baseTitle }),
    ...(pickOptionalField<number>(savedCard, "uid") !== undefined && { uid: savedCard.uid }),
    ...(shouldKeepCorruptedPositions && corruptedValuePositions && { corruptedValuePositions }),
  };
}
