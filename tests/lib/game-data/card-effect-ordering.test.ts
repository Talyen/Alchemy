import { describe, expect, it } from "vitest";
import { cardLibrary } from "@/lib/game-data";

const orderingInvariants: Array<{ cardId: string; firstKind: string; secondKind: string; reason: string }> = [
  {
    cardId: "cauterize",
    firstKind: "remove-harmful-status",
    secondKind: "self-damage",
    reason: "self-damage Burn must not be cleansed by the preceding status removal",
  },
  {
    cardId: "acid-potion",
    firstKind: "remove-enemy-armor",
    secondKind: "damage",
    reason: "armor removal must land before the Poison hit so the hit is unmitigated",
  },
  {
    cardId: "burning-blade",
    firstKind: "damage",
    secondKind: "damage",
    reason: "the Forge-scaled Burn hit resolves before the Physical hit",
  },
];

describe("card effect ordering invariants", () => {
  it.each(orderingInvariants)(
    "$cardId: $firstKind must precede $secondKind",
    ({ cardId, firstKind, secondKind, reason: _reason }) => {
      const card = cardLibrary.find((c) => c.id === cardId);
      expect(card, `cardLibrary missing ${cardId} — invariant cannot be checked`).toBeDefined();
      if (!card) return;
      const firstIdx = card.effects.findIndex((e) => e.kind === firstKind);
      // Search after the first hit so same-kind pairs (Burning Blade's two
      // damage hits) are ordered, not just co-present.
      const secondIdx = card.effects.findIndex((e, i) => i > firstIdx && e.kind === secondKind);
      expect(firstIdx, `expected ${firstKind} at index < ${secondIdx}`).toBeGreaterThanOrEqual(0);
      expect(secondIdx, `expected ${secondKind} after ${firstKind} at index ${firstIdx}`).toBeGreaterThan(firstIdx);
    },
  );
});
