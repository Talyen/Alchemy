import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import { describe, expect, it } from "vitest";
import { enemyById } from "@/lib/game-data";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";
import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";

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

  it("Glacial Surge adds exactly one Freeze damage from turn one and never increases other damage", () => {
    const card = (damageType: "freeze" | "burn") =>
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType, amount: 4 }] });
    for (const turn of [1, 2, 4, 20]) {
      const state = patchBattleState({
        currentEnemy: enemyById.frostwarden,
        turn,
        playerHealth: 1000,
        playerMaxHealth: 1000,
        roomScalingMultiplier: 1,
        rng: () => 0.99,
      });
      const freeze = applyEnemyAbility(state, card("freeze"), []);
      const burn = applyEnemyAbility(state, card("burn"), []);
      expect(freeze.playerHealth).toBe(997);
      expect(freeze.playerStatuses.freeze).toBe(3);
      expect(freeze.enemyStatuses.freezeBonus).toBe(0);
      expect(burn.playerHealth).toBe(998);
      expect(state.playerHealth).toBe(1000);
    }
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

  it("CC immunity feedback on cooldown for multiply-enemy-status emits Immune to Freeze notice when enemy status multiplier is blocked by player CC cooldown", () => {
    const state = patchBattleState({
      playerStatuses: { freeze: 10 },
      playerCC: { cooldown: 2, stunSkipTurns: 0, freezeSkipTurns: 0 },
      currentEnemy: { abilityIds: ["chill-spike"] },
    });
    const abilityCard = makeEnemyTestCard({
      id: "chill-spike",
      title: "Chill Spike",
      effects: [{ kind: "multiply-enemy-status", status: "freeze", factor: 2 }],
    });
    const combatTexts = makeTexts();
    const next = applyEnemyAbility(state, abilityCard, combatTexts);

    expect(next.playerStatuses.freeze).toBe(10);
    expect(combatTexts).toContainEqual({
      target: "player",
      kind: "notice",
      stat: "freeze",
      signal: "immune",
      text: "Immune to Freeze",
    });
  });
});
