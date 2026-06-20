import { describe, expect, it } from "vitest";
import { cardLibrary } from "@/lib/game-data";

const orderingInvariants: Array<{ cardId: string; firstKind: string; secondKind: string; reason: string }> = [
  {
    cardId: "cauterize",
    firstKind: "remove-harmful-status",
    secondKind: "self-damage",
    reason: "self-damage Burn must not be cleansed by the preceding status removal",
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
      const secondIdx = card.effects.findIndex((e) => e.kind === secondKind);
      expect(firstIdx, `expected ${firstKind} at index < ${secondIdx}`).toBeGreaterThanOrEqual(0);
      expect(secondIdx, `expected ${secondKind} at index > ${firstIdx}`).toBeGreaterThan(firstIdx);
    },
  );
});
