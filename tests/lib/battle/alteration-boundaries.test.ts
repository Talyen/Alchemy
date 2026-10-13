import { expect, it } from "vitest";
import { makeTestCard } from "../../fixtures/cards";
import { makeState } from "../../fixtures/battle";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";

it("keeps random buff pools out of flat-Block jackpots and Consume removal", () => {
  const card = makeTestCard({
    effects: [{ kind: "player-status", status: "block", amount: 2, statusPool: ["block", "forge"] }],
  });
  expect(getCorruptionMutationGroups(card).map((group) => group.kind)).not.toEqual(expect.arrayContaining(["bargain"]));
  expect(getCorruptionMutationGroups({ ...card, consume: true }).map((group) => group.kind)).not.toContain("reusable");
});
it("removes nested Companion summons without Consume talent rewards", () => {
  const state = makeState({ playerHealth: 10 });
  const card = makeTestCard({
    effects: [
      {
        kind: "chance",
        probability: 1,
        successEffects: [{ kind: "summon-companion", companionId: "wolf" }],
        failureEffects: [],
      },
    ],
  });
  const result = handlePostPlayCardDestination(
    { ...state, talentEffects: { ...state.talentEffects, healOnConsume: 3 } },
    card,
  );
  expect(result.playerHealth).toBe(10);
  expect(result.exhausted).toContain(card);
});
