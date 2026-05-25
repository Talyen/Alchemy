import { describe, expect, it } from "vitest";
import {
  addPlayerStatus,
  addEnemyStatus,
  setEnemyStatus,
  addGold,
  setFlag,
  clampHealth,
  applyPlayerCombatDamage,
  applyPlayerHealing,
  isPlayerDefeated,
  type BattleState,
} from "@/lib/battle/types";
import type { PlayerStatusId, EnemyStatusId } from "@/lib/game-data";
import { createTestBattleState } from "./test-state";

describe("addPlayerStatus", () => {
  it("adds delta to the given player status", () => {
    const state = createTestBattleState({ playerStatuses: { ...createTestBattleState().playerStatuses, block: 5 } });
    const next = addPlayerStatus(state, "block", 3);
    expect(next.playerStatuses.block).toBe(8);
  });

  it("does not mutate the original state", () => {
    const state = createTestBattleState();
    const next = addPlayerStatus(state, "block", 5);
    expect(state.playerStatuses.block).toBe(0);
    expect(next.playerStatuses.block).toBe(5);
  });

  it("supports negative delta", () => {
    const state = createTestBattleState({ playerStatuses: { ...createTestBattleState().playerStatuses, forge: 10 } });
    const next = addPlayerStatus(state, "forge", -3);
    expect(next.playerStatuses.forge).toBe(7);
  });

  it("works for all player status IDs", () => {
    const state = createTestBattleState();
    const ids: PlayerStatusId[] = ["block", "armor", "forge", "haste", "burn", "poison", "bleed", "freeze", "stun"];
    for (const id of ids) {
      const next = addPlayerStatus(state, id, 1);
      expect(next.playerStatuses[id]).toBe(1);
    }
  });
});

describe("addEnemyStatus", () => {
  it("adds delta to the given enemy status", () => {
    const state = createTestBattleState();
    const next = addEnemyStatus(state, "burn", 5);
    expect(next.enemyStatuses.burn).toBe(5);
  });

  it("does not mutate the original state", () => {
    const state = createTestBattleState();
    const next = addEnemyStatus(state, "poison", 3);
    expect(state.enemyStatuses.poison).toBe(0);
    expect(next.enemyStatuses.poison).toBe(3);
  });

  it("supports negative delta", () => {
    const state = createTestBattleState({ enemyStatuses: { ...createTestBattleState().enemyStatuses, burn: 4 } });
    const next = addEnemyStatus(state, "burn", -1);
    expect(next.enemyStatuses.burn).toBe(3);
  });

  it("works for all enemy status IDs", () => {
    const state = createTestBattleState();
    const ids: EnemyStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
    for (const id of ids) {
      const next = addEnemyStatus(state, id, 2);
      expect(next.enemyStatuses[id]).toBe(2);
    }
  });
});

describe("setEnemyStatus", () => {
  it("sets the given enemy status to a specific value", () => {
    const state = createTestBattleState();
    const next = setEnemyStatus(state, "bleed", 8);
    expect(next.enemyStatuses.bleed).toBe(8);
  });
});

describe("addGold", () => {
  it("adds delta to gold", () => {
    const state = createTestBattleState({ gold: 10 });
    const next = addGold(state, 5);
    expect(next.gold).toBe(15);
  });

  it("supports negative delta", () => {
    const state = createTestBattleState({ gold: 50 });
    const next = addGold(state, -20);
    expect(next.gold).toBe(30);
  });

  it("does not mutate the original state", () => {
    const state = createTestBattleState({ gold: 10 });
    addGold(state, 5);
    expect(state.gold).toBe(10);
  });
});

describe("setFlag", () => {
  it("sets a boolean flag", () => {
    const state = createTestBattleState();
    const next = setFlag(state, "firstPhysicalCardFreeUsed", true);
    expect(next.flags.firstPhysicalCardFreeUsed).toBe(true);
  });

  it("sets a numeric flag", () => {
    const state = createTestBattleState();
    const next = setFlag(state, "nextCardCostReduction", 3);
    expect(next.flags.nextCardCostReduction).toBe(3);
  });

  it("does not mutate the original state", () => {
    const state = createTestBattleState();
    const next = setFlag(state, "firstBurnCardDoubledUsed", true);
    expect(state.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(next.flags.firstBurnCardDoubledUsed).toBe(true);
  });

  it("preserves other flags", () => {
    const state = createTestBattleState({ flags: { ...createTestBattleState().flags, firstArmorCardDoubledUsed: true } });
    const next = setFlag(state, "firstHolyCardFreeUsed", true);
    expect(next.flags.firstHolyCardFreeUsed).toBe(true);
    expect(next.flags.firstArmorCardDoubledUsed).toBe(true);
  });
});

describe("clampHealth", () => {
  it("adds delta within bounds", () => {
    expect(clampHealth(20, 5, 30)).toBe(25);
  });

  it("caps at max", () => {
    expect(clampHealth(28, 5, 30)).toBe(30);
  });

  it("floors at 0", () => {
    expect(clampHealth(10, -15, 30)).toBe(0);
  });

  it("handles exact boundaries", () => {
    expect(clampHealth(0, 0, 30)).toBe(0);
    expect(clampHealth(30, 0, 30)).toBe(30);
  });
});

describe("applyPlayerCombatDamage", () => {
  it("reduces player health", () => {
    const state = createTestBattleState({ playerHealth: 20 });
    const next = applyPlayerCombatDamage(state, 5);
    expect(next.playerHealth).toBe(15);
  });

  it("returns same state when damage is 0", () => {
    const state = createTestBattleState({ playerHealth: 20 });
    const next = applyPlayerCombatDamage(state, 0);
    expect(next).toBe(state);
  });

  it("returns same state when damage is negative", () => {
    const state = createTestBattleState({ playerHealth: 20 });
    const next = applyPlayerCombatDamage(state, -5);
    expect(next).toBe(state);
  });

  it("triggers Death's Door on first lethal hit", () => {
    const state = createTestBattleState({ playerHealth: 10, turn: 3 });
    const next = applyPlayerCombatDamage(state, 20);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorUsed).toBe(true);
    expect(next.deathsDoorActive).toBe(true);
    expect(next.deathsDoorTriggeredTurn).toBe(3);
  });

  it("does not trigger Death's Door again on second lethal hit", () => {
    const state = createTestBattleState({ playerHealth: 10, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 3, turn: 4 });
    const next = applyPlayerCombatDamage(state, 20);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorUsed).toBe(true);
    expect(next.deathsDoorActive).toBe(true);
  });

  it("is defeated when hit while Death's Door already used and health was already 0", () => {
    const state = createTestBattleState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: false, deathsDoorTriggeredTurn: 3 });
    const next = applyPlayerCombatDamage(state, 5);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorActive).toBe(false);
  });
});

describe("applyPlayerHealing", () => {
  it("increases player health", () => {
    const state = createTestBattleState({ playerHealth: 15 });
    const next = applyPlayerHealing(state, 10);
    expect(next.playerHealth).toBe(25);
  });

  it("caps at max health", () => {
    const state = createTestBattleState({ playerHealth: 28 });
    const next = applyPlayerHealing(state, 10);
    expect(next.playerHealth).toBe(30);
  });

  it("clears Death's Door when healing above 0", () => {
    const state = createTestBattleState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 3 });
    const next = applyPlayerHealing(state, 5);
    expect(next.playerHealth).toBe(5);
    expect(next.deathsDoorActive).toBe(false);
  });

  it("preserves Death's Door active when still at 0 Health after heal", () => {
    const state = createTestBattleState({ playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: 3 });
    const next = applyPlayerHealing(state, 0);
    expect(next.playerHealth).toBe(0);
    expect(next.deathsDoorActive).toBe(true);
  });

  it("does not mutate original state", () => {
    const state = createTestBattleState({ playerHealth: 10 });
    applyPlayerHealing(state, 5);
    expect(state.playerHealth).toBe(10);
  });

  it("converts overhealing to block if overhealToBlockRatio talent is active", () => {
    const state = createTestBattleState({
      playerHealth: 25,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 2 },
      talentEffects: { ...createTestBattleState().talentEffects, overhealToBlockRatio: 0.5 },
    });
    // Heal 15 when at 25/30: health becomes 30 (caps). Overheal = 10.
    // Block gained = round(10 * 0.5) = 5. Total block = 2 + 5 = 7.
    const next = applyPlayerHealing(state, 15);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.block).toBe(7);
  });
});

describe("isPlayerDefeated", () => {
  it("returns false when health > 0", () => {
    expect(isPlayerDefeated({ playerHealth: 5, deathsDoorActive: false })).toBe(false);
  });

  it("returns false when Death's Door is active even at 0 Health", () => {
    expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: true })).toBe(false);
  });

  it("returns true when health <= 0 and no Death's Door", () => {
    expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: false })).toBe(true);
  });

  it("returns true when health is negative and no Death's Door", () => {
    expect(isPlayerDefeated({ playerHealth: -5, deathsDoorActive: false })).toBe(true);
  });

  it("returns true when health <= 0 and Death's Door already expired", () => {
    expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: false })).toBe(true);
  });
});
