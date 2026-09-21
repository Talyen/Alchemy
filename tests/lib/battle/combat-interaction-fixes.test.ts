import { describe, expect, it } from "vitest";
import { cardLibrary } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { drawOpeningHand } from "@/lib/battle/battle-setup";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

function card(id: string) {
  const found = cardLibrary.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing card: ${id}`);
  return found;
}

describe("combat interaction fixes", () => {
  it("Burning Blade spends the Forge it uses without requiring Ignite", () => {
    const blade = card("burning-blade");
    const state = patchBattleState({ rng: () => 0.99, hand: [blade], playerStatuses: { forge: 4 } });
    const result = playBattleCardResolved(state, blade.id, 0).state;
    expect(result.enemyHealth).toBe(state.enemyHealth - 5);
    expect(result.playerStatuses.forge).toBe(4);
  });

  it.each([
    ["opening draw", drawOpeningHand],
    ["next turn", advanceToPlayerTurn],
  ] as const)("offers Emergency Wish with an empty restored deck on %s", (_label, draw) => {
    const state = patchBattleState({ hand: [], deck: [], discard: [], exhausted: [] });
    const result = draw(state);
    expect(result.wishOptions?.length).toBeGreaterThan(0);
  });

  it("Returning Flight recovers an unplayed card returned by Red Harvest", () => {
    const arrow = { ...card("venom-arrow"), uid: 10 };
    const state = patchBattleState({
      rng: () => 0.99,
      hand: [arrow],
      deck: [],
      discard: [],
      nextCardUid: 11,
      gearEffects: { returnFirstPhysicalCard: 1, recoverLastArcheryCard: 1 },
      enemyCC: { stunSkipTurns: 1 },
    });
    const played = playBattleCardResolved(state, arrow.id, 0).state;
    const next = endPlayerTurn(played).state;
    expect(next.hand).toHaveLength(1);
    expect(next.uniqueGear.returningFlightUid).toBe(next.hand[0]?.uid);
  });

  it("stops enemy trait pulses when a status-tick cleanse kills Blood Countess", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 26,
      playerMaxHealth: 100,
      enemyHealth: 1,
      playerStatuses: { burn: 2 },
      currentEnemy: {
        abilityIds: ["block"],
        traits: ["blood-countess", "toxic"].map((id) => ({ id, title: "", description: "" })),
      },
      talentEffects: { cleanseBelowHealthPercent: 25, healOnStatusCleanse: 1 },
    });
    const result = endPlayerTurn(state).state;
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.poison).toBe(0);
  });

  it("Aetherward reduces Pyromancy's bonus together with the attack", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 2,
      gearEffects: { damageReductionPerMana: 10 },
      currentEnemy: { traits: [{ id: "pyromancer", title: "", description: "" }] },
    });
    const result = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 2 }] }),
      [],
    );
    expect(result.playerHealth).toBe(state.playerHealth);
    expect(result.playerStatuses.burn).toBe(0);
  });
});
