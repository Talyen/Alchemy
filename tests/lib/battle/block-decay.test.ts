import { describe, expect, it } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import type { BattleState } from "@/lib/battle/types";
import { defaultTalentEffects } from "@/lib/battle";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { defaultTrinketManifest } from "../../fixtures/default-battle-state";

function makeState(overrides: BattleStatePatch = {}): BattleState {
  return patchBattleState({
    currentEnemy: { abilityIds: ["slash", "bash", "sunder"] },
    rng: () => 0.99,
    playerHealth: 30,
    playerMaxHealth: 30,
    playerStatuses: { block: 10 },
    enemyHealth: 30,
    enemyMaxHealth: 30,
    enemyStatuses: {},
    deck: [],
    mana: 4,
    maxMana: 4,
    talentEffects: defaultTalentEffects,
    ...overrides,
  });
}

describe("block decay timing", () => {
  it("absorbs enemy damage before block decays", () => {
    const state = makeState({ playerStatuses: { block: 10 } });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("block decays when no damage is taken", () => {
    const state = makeState({ enemyCC: { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 } });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(5);
  });

  it("block absorbs partial damage then decays remainder", () => {
    const state = makeState({ playerStatuses: { block: 3 } });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(29);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("block decays during turn transition after enemy phase completes", () => {
    const state = makeState({
      playerStatuses: { block: 9 },
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("does not trigger Ironwood Buckler when Block is decayed or preserved", () => {
    const trinketEffects = defaultTrinketManifest({ ironwoodBucklerThornsOnBlock: 1 });
    const decayed = endPlayerTurn(
      makeState({
        trinketEffects,
      }),
    );
    const preserved = endPlayerTurn(
      makeState({
        playerStatuses: { block: 10, haste: 1 },
        trinketEffects,
      }),
    );

    expect(decayed.state.playerStatuses.thorns).toBe(0);
    expect(preserved.state.playerStatuses.block).toBe(10);
    expect(preserved.state.playerStatuses.thorns).toBe(0);
  });

  it("enemy block decays at the start of the enemy phase after the player had an attack window", () => {
    const state = makeState({
      enemyMitigation: { block: 9 },
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.block).toBe(5);
  });

  it("enemy block gained during the enemy phase survives until the next enemy phase", () => {
    const reinforcedEnemy = {
      traits: [ENCOUNTER_TRAITS.reinforced.enemyTrait],
      abilityIds: ["slash", "bash", "sunder"],
    };
    const first = endPlayerTurn(
      makeState({
        currentEnemy: reinforcedEnemy,
        enemyMitigation: { block: 0 },
      }),
    );
    expect(first.state.enemyMitigation.block).toBe(2);

    const second = endPlayerTurn(first.state);
    expect(second.state.enemyMitigation.block).toBe(3);
  });
});
