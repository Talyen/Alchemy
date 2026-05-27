// Pure alchemist potion-combining logic.
// Depends only on battle card shapes and the Mixed Potion art/data shell.
// Used by shop controller and UI previews so mixing behavior stays testable outside React.
import type { BattleCard } from "@/lib/game-data";
import { mixedPotion } from "@/lib/game-data";
import { logError } from "@/lib/error-logger";
import {
  CONSUME_DESCRIPTION_LINE,
  MIXED_POTION_CARD_ID,
  MIXED_POTION_COST,
  MIXED_POTION_TITLE,
} from "@/lib/game-constants";

const MIXED_POTION_ERROR = "Cannot mix with an existing Mixed Potion";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/** Pure logic for combining two potion cards into a Mixed Potion.
 * Used by the Alchemist's Shop controller so the mixing logic is independently testable. */
export function createMixedPotion(cardA: BattleCard, cardB: BattleCard, potencyBonus: number = 0): BattleCard {
  // Existing Mixed Potions are rejected to avoid recursively combining generated effects.
  // Same potion doubles numeric effects; different potions concatenate effects, and Consume
  // is normalized to one final line so descriptions do not accumulate duplicates.
  if (cardA.id === MIXED_POTION_CARD_ID || cardB.id === MIXED_POTION_CARD_ID) {
    throw new Error(MIXED_POTION_ERROR);
  }

  const sameCard = cardA.id === cardB.id;

  // Build effects: duplicate & double amounts for same card, concatenate for different cards.
  const effects = sameCard
    ? cardA.effects.map((e) => {
        if ("amount" in e) return { ...e, amount: e.amount * 2 + potencyBonus };
        return { ...e };
      })
    : [...cardA.effects, ...cardB.effects].map((e) => {
        if ("amount" in e) return { ...e, amount: e.amount + potencyBonus };
        return { ...e };
      });

  // Build description lines, deduplicating via Set.
  // Strip "Consume" during aggregation, then add it once at the end.
  const descs = new Set<string>();
  for (const line of [...cardA.descriptionLines, ...cardB.descriptionLines]) {
    if (line === CONSUME_DESCRIPTION_LINE) continue;
    if (sameCard) {
      descs.add(line.replace(/\d+/g, (match) => String(Number(match) * 2 + potencyBonus)));
    } else {
      descs.add(line.replace(/\d+/g, (match) => String(Number(match) + potencyBonus)));
    }
  }
  const descriptionLines = [...descs, CONSUME_DESCRIPTION_LINE];

  const idSeed = `${cardA.id}-${cardA.uid ?? 0}-${cardB.id}-${cardB.uid ?? 0}`;

  return {
    id: `${MIXED_POTION_CARD_ID}-${hashCode(idSeed)}`,
    title: MIXED_POTION_TITLE,
    descriptionLines,
    art: mixedPotion,
    cost: MIXED_POTION_COST,
    consume: true,
    effects: effects as BattleCard["effects"],
  };
}

export function tryCreateMixedPotion(
  cardA: BattleCard | undefined,
  cardB: BattleCard | undefined,
  potencyBonus: number = 0,
): BattleCard | null {
  if (!cardA || !cardB) return null;
  try {
    return createMixedPotion(cardA, cardB, potencyBonus);
  } catch {
    logError(`Mix failed: ${MIXED_POTION_ERROR}`, "card");
    return null;
  }
}

/** Removes the two cards at the given indices from the deck and appends the mixed potion.
 * Higher index is identified to safely reconstruct the array without shift issues. */
export function applyMixToDeck(deck: BattleCard[], indexA: number, indexB: number, mixed: BattleCard): BattleCard[] {
  const highIdx = Math.max(indexA, indexB);
  const lowIdx = Math.min(indexA, indexB);
  const next = deck.filter((_, i) => i !== highIdx && i !== lowIdx);
  next.push(mixed);
  return next;
}
