import { describe, expect, it } from "vitest";
import { defaultBattleState, endPlayerTurn, applyPlayerCombatDamage } from "@/lib/battle";
import { tryDodgeEnemyAttackPacket } from "@/lib/battle/dodge";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { applyLoseHealthEffect } from "@/lib/battle/effect-handlers/mana-health-handlers";
import { dealSelfDamage } from "@/lib/battle/status-helpers";
import { dealDamage, incomingPhysical, makeTestCard } from "../../fixtures/battle";

function rhythmState() {
  return incomingPhysical({ rng: () => 0.99, talentEffects: { dodgeChanceOnHostileDamage: 5 } });
}

describe("Finding Rhythm", () => {
  it("gains 5 points for each hostile Health damage instance and carries it across turns", () => {
    const state = rhythmState();
    const first = processEnemyAttack(state, []);
    const second = processEnemyAttack(first, []);
    expect(first.dodgeChanceFromDamage).toBe(5);
    expect(second.dodgeChanceFromDamage).toBe(10);
    const nextTurn = endPlayerTurn(second).state;
    expect(nextTurn.dodgeChanceFromDamage).toBe(15);
    expect(state.dodgeChanceFromDamage).toBe(0);
  });

  it("updates chance between packets and resets immediately when a later packet is Dodged", () => {
    const state = rhythmState();
    const result = processEnemyAttack(
      {
        ...state,
        rng: () => 0.075,
        enemyAttackEffects: [
          { kind: "damage", damageType: "physical", amount: 1 },
          { kind: "damage", damageType: "physical", amount: 1 },
          { kind: "damage", damageType: "physical", amount: 1 },
        ],
      },
      [],
    );
    expect(result.playerDodgeCount).toBe(1);
    expect(result.dodgeChanceFromDamage).toBe(5);
    expect(result.playerHealth).toBe(98);
  });

  it("counts separate harmful status ticks and enemy pulses even though neither can be Dodged", () => {
    const state = rhythmState();
    const dotted = tickPlayerStatuses(
      { ...state, playerStatuses: { ...state.playerStatuses, burn: 2, poison: 2, bleed: 2 } },
      [],
    );
    expect(dotted.dodgeChanceFromDamage).toBe(15);
    expect(dotted.playerDodgeCount).toBe(0);
    const pulse = processEnemyDamageEffect(
      { ...dotted, rng: () => 0 },
      { kind: "damage", damageType: "holy", amount: 1 },
      [],
    );
    expect(pulse.dodgeChanceFromDamage).toBe(20);
    expect(pulse.playerDodgeCount).toBe(0);
  });

  it("does not count Block, Armor, resistance, or flat reduction that fully prevents Health damage", () => {
    const state = rhythmState();
    for (const protectedState of [
      { ...state, playerStatuses: { ...state.playerStatuses, block: 100 } },
      { ...state, playerStatuses: { ...state.playerStatuses, armor: 100 } },
      { ...state, gearEffects: { ...state.gearEffects, resistPhysical: 100 } },
      { ...state, talentEffects: { ...state.talentEffects, damageReduction: 100 } },
    ]) {
      const result = processEnemyAttack(protectedState, []);
      expect(result.playerHealth).toBe(100);
      expect(result.dodgeChanceFromDamage).toBe(0);
    }
  });

  it("excludes self-damage", () => {
    const state = rhythmState();
    const damaged = dealSelfDamage(state, 5, "health", []).state;
    expect(damaged.playerHealth).toBe(95);
    expect(damaged.dodgeChanceFromDamage).toBe(0);
    expect(applyPlayerCombatDamage(state, 5, "self").dodgeChanceFromDamage).toBe(0);
    const paid = applyLoseHealthEffect(state, makeTestCard(), { kind: "lose-health", amount: 5 }, 1, []);
    expect(paid.playerHealth).toBe(95);
    expect(paid.dodgeChanceFromDamage).toBe(0);
  });

  it("counts damage before Phoenix Feather recovery and Death's Door protection", () => {
    const state = rhythmState();
    const feather = applyPlayerCombatDamage(
      { ...state, playerHealth: 5, playerStatuses: { ...state.playerStatuses, phoenixFeather: 1 } },
      10,
      "hostile",
    );
    expect(feather.playerHealth).toBe(30);
    expect(feather.dodgeChanceFromDamage).toBe(5);
    const door = applyPlayerCombatDamage({ ...state, playerHealth: 1 }, 10, "hostile");
    expect(door.playerHealth).toBe(1);
    expect(door.dodgeChanceFromDamage).toBe(5);
  });

  it("clears on victory or defeat", () => {
    const state = { ...rhythmState(), dodgeChanceFromDamage: 20, enemyHealth: 1 };
    const victory = dealDamage(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
    );
    expect(victory.enemyHealth).toBe(0);
    expect(victory.dodgeChanceFromDamage).toBe(0);
    const defeat = applyPlayerCombatDamage({ ...state, playerHealth: 1, deathsDoorUsed: true }, 10, "hostile");
    expect(defeat.playerHealth).toBe(0);
    expect(defeat.dodgeChanceFromDamage).toBe(0);
  });

  it("has no separate stack cap, clears on Dodge, and starts each battle empty", () => {
    let state = rhythmState();
    for (let index = 0; index < 20; index++) state = applyPlayerCombatDamage(state, 1, "hostile");
    expect(state.dodgeChanceFromDamage).toBe(100);
    const dodged = tryDodgeEnemyAttackPacket({ ...state, rng: () => 0.74 }, [], true);
    expect(dodged?.dodgeChanceFromDamage).toBe(0);
    expect(defaultBattleState().dodgeChanceFromDamage).toBe(0);
    expect(defaultBattleState().playerDodgeCount).toBe(0);
  });
});
