import { describe, expect, it } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import type { BattleState } from "@/lib/battle/types";
import { defaultTalentEffects } from "@/lib/battle";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { makeTestBattleState } from "../../fixtures/battle";

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return makeTestBattleState({
    playerHealth: 30,
    playerMaxHealth: 30,
    playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10 },
    enemyHealth: 30,
    enemyMaxHealth: 30,
    enemyStatuses: { ...makeTestBattleState().enemyStatuses },
    enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    deck: [makeTestBattleState().deck[0]],
    mana: 4,
    maxMana: 4,
    talentEffects: defaultTalentEffects,
    ...overrides,
  });
}

describe("block decay timing", () => {
  it("absorbs enemy damage before block decays", () => {
    const state = makeState({ playerStatuses: { ...makeTestBattleState().playerStatuses, block: 10 } });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("block decays when no damage is taken", () => {
    const state = makeState({ enemyAttackEffects: [] });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(5);
  });

  it("block absorbs partial damage then decays remainder", () => {
    const state = makeState({ playerStatuses: { ...makeTestBattleState().playerStatuses, block: 3 } });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(29);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("block decays during turn transition after enemy phase completes", () => {
    const state = makeState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 7 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("enemy block decays at the start of the enemy phase after the player had an attack window", () => {
    const state = makeState({
      enemyAttackEffects: [],
      enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 9 },
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.block).toBe(5);
  });

  it("enemy block gained during the enemy phase survives until the next enemy phase", () => {
    const reinforcedEnemy = {
      ...makeTestBattleState().currentEnemy,
      traits: [ENCOUNTER_TRAITS.reinforced.enemyTrait],
      attackEffects: [],
    };
    const first = endPlayerTurn(
      makeState({
        currentEnemy: reinforcedEnemy,
        enemyAttackEffects: [],
        enemyMitigation: { ...makeTestBattleState().enemyMitigation, block: 0 },
      }),
    );
    expect(first.state.enemyMitigation.block).toBe(2);

    const second = endPlayerTurn(first.state);
    expect(second.state.enemyMitigation.block).toBe(3);
  });
});
