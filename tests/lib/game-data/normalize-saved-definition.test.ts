import { expect, it } from "vitest";
import { createEffectDescription, withCardDescription, type BattleCardEffect } from "@/lib/game-data";
import { normalizeSavedCardDefinition } from "@/lib/game-data/cards/normalize-saved-definition";
import { makeTestCard } from "../../fixtures/cards";

function legacyCard() {
  const effects: BattleCardEffect[] = [
    { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true, equalToBlockPercent: 50 },
  ];
  return withCardDescription(
    makeTestCard({ id: "shield-bash", definitionVersion: 0, effects }),
    createEffectDescription(effects),
  );
}

it("normalizes a single retired Block clause without changing its input", () => {
  const card = legacyCard();
  const before = structuredClone(card);
  const result = normalizeSavedCardDefinition(card);
  expect(result.outcome).toBe("normalized");
  expect(result.card.effects[0]).toMatchObject({ spendBlock: true });
  expect(card).toEqual(before);
  expect(normalizeSavedCardDefinition(result.card).outcome).toBe("unchanged");
});

it.each([false, true])("rejects repeated clauses in the same string (structured prose: %s)", (structured) => {
  const card = legacyCard();
  const clause = card.descriptionLines[0]!;
  if (structured) card.description = [{ parts: [clause + clause], role: "effect" }];
  else card.descriptionLines = [clause + clause];
  expect(normalizeSavedCardDefinition(card).outcome).toBe("ambiguous");
});

it("preserves normalization for legacy cards without structured descriptions", () => {
  const card = legacyCard();
  delete card.description;
  expect(normalizeSavedCardDefinition(card).outcome).toBe("normalized");
});
