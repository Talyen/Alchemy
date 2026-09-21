import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import { describe, expect, it } from "vitest";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";
import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { defaultCcState } from "../../fixtures/default-battle-state";

describe("applyEnemyAbility: status", () => {
  it("applies burn status rider on burn damage dealt", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.burn).toBe(4);
    expect(result.playerHealth).toBe(26);
  });

  it("halves freeze damage and buildup when receiveHalfFreezeDamage talent is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: { receiveHalfFreezeDamage: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 10 }] }),
      makeTexts(),
    );

    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.freeze).toBe(5);
  });

  it("halves enemy burn damage and burn stacks when receiveHalfBurnDamage is active", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      talentEffects: { receiveHalfBurnDamage: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(28);
    expect(result.playerStatuses.burn).toBe(2);
  });

  it("adds enemy burnBonus to burn damage", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0 },
      enemyStatuses: { burnBonus: 2 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(24);
  });

  it("adds enemy freezeBonus to freeze damage and buildup", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0 },
      enemyStatuses: { freezeBonus: 2 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 4 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(24);
    expect(result.playerStatuses.freeze).toBe(6);
  });

  it("does not heal enemy on lifesteal when freeze blocks regen", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { freezeBlocksRegen: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }] }),
      makeTexts(),
    );
    expect(result.enemyHealth).toBe(20);
  });

  it("applies player-status attack effects", () => {
    const state = patchBattleState({});
    const result = applyPlayerStatusFromAttack(
      state,
      { kind: "player-status", status: "poison", amount: 2 },
      makeTexts(),
    );
    expect(result.playerStatuses.poison).toBe(2);
  });

  it("immediately triggers player stun when incoming buildup reaches threshold", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 20 }] }),
      texts,
    );
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("Grounding prevents stun buildup when the player has block", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 4, armor: 0 },
      talentEffects: { blockPreventsStun: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 8 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(0);
  });

  it("Grounding still prevents stun buildup when the hit spends the last Block", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 3, armor: 0 },
      talentEffects: { blockPreventsStun: true },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 10 }] }),
      makeTexts(),
    );
    expect(result.playerStatuses.block).toBe(0);
    expect(result.playerStatuses.stun).toBe(0);
    expect(result.playerCC.stunSkipTurns).toBe(0);
  });

  it("immediately triggers player freeze when incoming buildup reaches threshold", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 20 }] }),
      texts,
    );
    expect(result.playerStatuses.freeze).toBe(0);
    expect(result.playerCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "notice", stat: "freeze", text: "Frozen" });
  });
});
