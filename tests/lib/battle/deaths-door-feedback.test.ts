import { describe, expect, it } from "vitest";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { dealSelfDamage } from "@/lib/battle/status-helpers";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { applyPlayerCombatDamage, type CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState } from "../../fixtures/battle";

function protectedState() {
  return makeTestBattleState({ playerHealth: 1, deathsDoorActive: true, deathsDoorUsed: true });
}

const skull = { target: "player", kind: "notice", stat: "deathsDoor", text: "" };
const attack = { kind: "damage", damageType: "physical", amount: 5 } as const;

describe("Death's Door feedback", () => {
  it("emits one skull for each protected enemy hit", () => {
    const texts: CombatTextEvent[] = [];
    const first = processEnemyDamageEffect(protectedState(), attack, texts);
    const second = processEnemyDamageEffect(first, attack, texts);
    expect(second.playerHealth).toBe(1);
    expect(texts).toEqual([skull, skull]);
  });

  it.each(["burn", "poison", "bleed"] as const)("shows a skull for protected %s damage", (status) => {
    const state = protectedState();
    const texts: CombatTextEvent[] = [];
    const result = tickPlayerStatuses({ ...state, playerStatuses: { ...state.playerStatuses, [status]: 5 } }, texts);
    expect(result.playerHealth).toBe(1);
    expect(texts).toEqual([skull]);
  });

  it("shows a skull for protected self-damage without reporting health lost", () => {
    const texts: CombatTextEvent[] = [];
    const result = dealSelfDamage(protectedState(), 5, "health", texts);
    expect(result.healthLost).toBe(0);
    expect(result.state.playerHealth).toBe(1);
    expect(texts).toEqual([skull]);
  });

  it.each([0, -1, Number.NaN])("does not show a skull for invalid or zero damage %s", (damage) => {
    const texts: CombatTextEvent[] = [];
    applyPlayerCombatDamage(protectedState(), damage, undefined, undefined, texts);
    expect(texts).toEqual([]);
  });

  it.each(["block", "armor"] as const)("does not show a skull when %s absorbs the hit", (status) => {
    const state = protectedState();
    const texts: CombatTextEvent[] = [];
    processEnemyDamageEffect({ ...state, playerStatuses: { ...state.playerStatuses, [status]: 10 } }, attack, texts);
    expect(texts.some((event) => event.stat === "deathsDoor")).toBe(false);
  });

  it("does not show a skull when damage reduction prevents health loss", () => {
    const state = protectedState();
    const texts: CombatTextEvent[] = [];
    dealSelfDamage({ ...state, talentEffects: { ...state.talentEffects, damageReduction: 10 } }, 5, "health", texts);
    expect(texts).toEqual([]);
  });

  it.each([
    { playerHealth: 10, deathsDoorActive: true, deathsDoorUsed: true },
    { playerHealth: 3, deathsDoorActive: true, deathsDoorUsed: true },
    { playerHealth: 3, deathsDoorActive: false, deathsDoorUsed: false },
    { playerHealth: 1, deathsDoorActive: false, deathsDoorUsed: true },
  ])("preserves health-loss feedback for $playerHealth health and active=$deathsDoorActive", (overrides) => {
    const texts: CombatTextEvent[] = [];
    const result = processEnemyDamageEffect(makeTestBattleState(overrides), attack, texts);
    expect(texts).toEqual([
      { target: "player", kind: "damage", stat: "health", amount: overrides.playerHealth - result.playerHealth },
    ]);
  });
});
