import { expect, it } from "vitest";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { makeTestCard } from "../../fixtures/cards";

it("converts unconditional Mana restoration when its optional condition is explicitly false", () => {
  const card = makeTestCard({ effects: [{ kind: "restore-mana", amount: 2, ifEnemyFrozen: false }] });
  expect(getTransmutationVariants(card, "gold", [card])[0]?.result.effects).toEqual([{ kind: "gain-gold", amount: 2 }]);
  const conditional = { ...card, effects: [{ kind: "restore-mana" as const, amount: 2, ifEnemyFrozen: true }] };
  expect(getTransmutationVariants(conditional, "gold", [conditional])).toEqual([]);
});
