import { describe, expect, it } from "vitest";
import { parseActiveRun } from "@/lib/active-run-session";
import { cardById, cardLibrary } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { makeMinimalActiveRunInput } from "../../fixtures/active-run";

const examples = ["slash", "block", "health-potion"].flatMap((id) =>
  getCorruptionMutationGroups(cardById[id]!).map((group) => ({ id, kind: group.kind, mutation: group.mutations[0]! })),
);

describe("expanded corruption persistence", () => {
  it.each(examples)("retains $id $kind in the deck and completed altar on repeated resume", ({ id, mutation }) => {
    const originalCard = { ...cardById[id]!, uid: 42 };
    const corruptedCard = { ...mutation.card, uid: 42 };
    const raw = makeMinimalActiveRunInput({
      currentScreen: "corruption",
      runDeck: [corruptedCard],
      corruptionResult: { originalCard, corruptedCard, transformed: false, delta: mutation.delta },
    });
    const first = parseActiveRun(JSON.parse(JSON.stringify(raw)));
    expect(first).not.toBeNull();
    const second = parseActiveRun(JSON.parse(JSON.stringify(first)));
    expect(second).toEqual(first);
    for (const restored of [second?.runDeck[0], second?.corruptionResult?.corruptedCard]) {
      expect(restored?.effects).toEqual(corruptedCard.effects);
      expect(restored?.descriptionLines).toEqual(corruptedCard.descriptionLines);
      expect(restored?.consume).toBe(corruptedCard.consume);
      expect(restored?.corruptedValuePositions ?? []).toEqual(corruptedCard.corruptedValuePositions ?? []);
      expect(restored?.uid).toBe(42);
      expect(restored?.corrupted).toBe(true);
    }
  });

  it("validates and hydrates every catalog mutation without discarding its effects", () => {
    for (const original of cardLibrary) {
      for (const group of getCorruptionMutationGroups(original)) {
        for (const { card } of group.mutations) {
          const loaded = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(card))));
          expect(loaded.effects, `${original.id}: ${group.kind}`).toEqual(card.effects);
          expect(loaded.descriptionLines).toEqual(card.descriptionLines);
          expect(loaded.consume).toBe(card.consume);
          expect(loaded.corruptedValuePositions ?? []).toEqual(card.corruptedValuePositions ?? []);
        }
      }
    }
  });
});
