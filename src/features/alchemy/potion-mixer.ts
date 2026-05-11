// Pure alchemist potion-combining logic.
// Depends only on battle card shapes and the Mixed Potion art/data shell.
// Used by shop controller and UI previews so mixing behavior stays testable outside React.
import type { BattleCard } from "@/lib/game-data";
import { mixedPotion } from "@/lib/game-data";

/** Pure logic for combining two potion cards into a Mixed Potion.
 * Used by the Alchemist's Shop controller so the mixing logic is independently testable. */
export function createMixedPotion(cardA: BattleCard, cardB: BattleCard): BattleCard {
  // Existing Mixed Potions are rejected to avoid recursively combining generated effects.
  // Same potion doubles numeric effects; different potions concatenate effects, and Consume
  // is normalized to one final line so descriptions do not accumulate duplicates.
  if (cardA.id === "mixed-potion" || cardB.id === "mixed-potion") {
    throw new Error("Cannot mix with an existing Mixed Potion");
  }

  const sameCard = cardA.id === cardB.id;

  // Build effects: duplicate & double amounts for same card, concatenate for different cards.
  const effects = sameCard
    ? cardA.effects.map((e) => {
        if ('amount' in e) return { ...e, amount: e.amount * 2 };
        return { ...e };
      })
    : [...cardA.effects, ...cardB.effects];

  // Build description lines, deduplicating via Set.
  // Strip "Consume" during aggregation, then add it once at the end.
  const descs = new Set<string>();
  for (const line of [...cardA.descriptionLines, ...cardB.descriptionLines]) {
    if (line === "Consume") continue;
    if (sameCard) {
      const numMatch = line.match(/(\d+)/);
      if (numMatch) descs.add(line.replace(numMatch[0], String(Number(numMatch[0]) * 2)));
      else descs.add(line);
    } else {
      descs.add(line);
    }
  }
  const descriptionLines = [...descs, "Consume"];

  return {
    id: `mixed-potion-${Date.now()}`,
    title: "Mixed Potion",
    descriptionLines,
    art: mixedPotion,
    cost: 1,
    template: "alchemy",
    consume: true,
    effects: effects as BattleCard["effects"],
  };
}

/** Removes the two cards at the given indices from the deck and appends the mixed potion.
 * Higher index is identified to safely reconstruct the array without shift issues. */
export function applyMixToDeck(
  deck: BattleCard[],
  indexA: number,
  indexB: number,
  mixed: BattleCard,
): BattleCard[] {
  const highIdx = Math.max(indexA, indexB);
  const lowIdx = Math.min(indexA, indexB);
  const next = deck.filter((_, i) => i !== highIdx && i !== lowIdx);
  next.push(mixed);
  return next;
}
