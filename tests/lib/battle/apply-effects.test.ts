import { makeDamageCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeState, makeTestCard } from "../../fixtures/battle";

describe("applyCardEffects", () => {
  it("does not repeat card effects when the first copy defeats the enemy", () => {
    const card = makeDamageCard("physical", 10, { id: "slash" });
    const state = makeState({
      enemyHealth: 8,
      hand: [card],
      flags: { playNextCardTwice: true },
    });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.flags.playNextCardTwice).toBe(false);
  });

  it.each([
    [0, 28],
    [4, 20],
  ])("cleanses received Burn after %i existing stacks, critically hits, and consumes the flag", (burn, enemyHealth) => {
    const card = makeTestCard({
      id: "exorcism",
      effects: [
        { kind: "self-damage", damageType: "burn", amount: 1 },
        { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
      ],
    });
    const state = makeState({
      enemyHealth: 30,
      hand: [card],
      playerStatuses: { burn },
      flags: { nextHitCrit: true },
    });
    const result = playBattleCardResolved(state, "exorcism", 0);
    expect(result.state.enemyHealth).toBe(enemyHealth);
    expect(result.state.flags.nextHitCrit).toBe(false);
    expect(result.state.playerStatuses.burn).toBe(0);
  });
});

describe("applyCardEffects — multiply-enemy-status", () => {
  it("halves added stun stacks against a braced enemy like every other stack source", () => {
    const state = makeState({
      enemyStatuses: { stun: 3 },
      currentEnemy: {
        id: "braced-test-enemy",
        title: "Braced Test Enemy",
        subtitle: "",
        descriptionLines: [],
        art: "",
        enemyType: "boss",
        traits: [{ id: "braced" }],
        abilityIds: ["slash", "bash", "block"],
      } as never,
    });
    const card = makeTestCard({ effects: [{ kind: "multiply-enemy-status", status: "stun", factor: 2 }] });
    const result = applyCardEffects(state, card, []);

    expect(result.enemyStatuses.stun).toBe(5);
  });
});
