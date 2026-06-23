// Rehydrates a saved card against the library entry. Re-exported by ../cards.
import type { BattleCard } from "../types";
import { cardLibrary } from "../cards";

type SavedCard = BattleCard & {
  descriptionLinesFullyValid?: boolean;
  effectsFullyValid?: boolean;
};

export function hydrateCard(savedCard: BattleCard): BattleCard {
  const libraryCard = cardLibrary.find((c) => c.id === savedCard.id);
  if (!libraryCard) return savedCard;

  const saved = savedCard as SavedCard;

  const descriptionLines =
    Array.isArray(saved.descriptionLines) && saved.descriptionLinesFullyValid !== false
      ? [...saved.descriptionLines]
      : [...libraryCard.descriptionLines];

  const effects =
    Array.isArray(saved.effects) && saved.effectsFullyValid !== false
      ? (saved.effects.map((e) => (typeof e === "object" ? { ...e } : e)) as BattleCard["effects"])
      : libraryCard.effects.map((e) => ({ ...e }));

  const cost =
    typeof saved.cost === "number" && Number.isFinite(saved.cost) && saved.cost >= 0
      ? Math.round(saved.cost)
      : libraryCard.cost;

  const corruptedValuePositions =
    Array.isArray(saved.corruptedValuePositions) && saved.corruptedValuePositions.length > 0
      ? saved.corruptedValuePositions
      : undefined;

  const result: BattleCard = { ...libraryCard, descriptionLines, effects, cost };

  if (saved.consume !== undefined) {
    result.consume = saved.consume;
  }
  if (saved.corrupted !== undefined) {
    result.corrupted = saved.corrupted;
  }
  if (saved.baseTitle !== undefined) {
    result.baseTitle = saved.baseTitle;
  }
  if (saved.uid !== undefined) {
    result.uid = saved.uid;
  }
  if (corruptedValuePositions) {
    result.corruptedValuePositions = corruptedValuePositions;
  }

  return result;
}
