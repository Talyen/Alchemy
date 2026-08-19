import { describe, expect, it } from "vitest";
import {
  addPlayerStatus,
  addEnemyStatus,
  setEnemyStatus,
  addGold,
  setFlag,
  clampHealth,
  applyPlayerHealing,
  isPlayerDefeated,
} from "@/lib/battle/types";
import type { PlayerStatusId, EnemyStatusId } from "@/lib/game-data";
import { makeTestBattleState } from "../../fixtures/battle";

describe("addPlayerStatus", () => {
  it("adds delta to the given player status", () => {
    const state = makeTestBattleState({ playerStatuses: { ...makeTestBattleState().playerStatuses, block: 5 } });
    const next = addPlayerStatus(state, "block", 3);
    expect(next.playerStatuses.block).toBe(8);
  });

  it("does not mutate the original state", () => {
    const state = makeTestBattleState();
    const next = addPlayerStatus(state, "block", 5);
    expect(state.playerStatuses.block).toBe(0);
    expect(next.playerStatuses.block).toBe(5);
  });

  it("supports negative delta", () => {
    const state = makeTestBattleState({ playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 10 } });
    const next = addPlayerStatus(state, "forge", -3);
    expect(next.playerStatuses.forge).toBe(7);
  });

  it("works for all player status IDs", () => {
    const state = makeTestBattleState();
    const ids: PlayerStatusId[] = ["block", "armor", "forge", "haste", "burn", "poison", "bleed", "freeze", "stun"];
    for (const id of ids) {
      const next = addPlayerStatus(state, id, 1);
      expect(next.playerStatuses[id]).toBe(1);
    }
  });
});

describe("addEnemyStatus", () => {
  it("adds delta to the given enemy status", () => {
    const state = makeTestBattleState();
    const next = addEnemyStatus(state, "burn", 5);
    expect(next.enemyStatuses.burn).toBe(5);
  });

  it("does not mutate the original state", () => {
    const state = makeTestBattleState();
    const next = addEnemyStatus(state, "poison", 3);
    expect(state.enemyStatuses.poison).toBe(0);
    expect(next.enemyStatuses.poison).toBe(3);
  });

  it("supports negative delta", () => {
    const state = makeTestBattleState({ enemyStatuses: { ...makeTestBattleState().enemyStatuses, burn: 4 } });
    const next = addEnemyStatus(state, "burn", -1);
    expect(next.enemyStatuses.burn).toBe(3);
  });

  it("works for all enemy status IDs", () => {
    const state = makeTestBattleState();
    const ids: EnemyStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
    for (const id of ids) {
      const next = addEnemyStatus(state, id, 2);
      expect(next.enemyStatuses[id]).toBe(2);
    }
  });
});

describe("setEnemyStatus", () => {
  it("sets the given enemy status to a specific value", () => {
    const state = makeTestBattleState();
    const next = setEnemyStatus(state, "bleed", 8);
    expect(next.enemyStatuses.bleed).toBe(8);
  });
});

describe("addGold", () => {
  it("adds delta to gold", () => {
    const state = makeTestBattleState({ gold: 10 });
    const next = addGold(state, 5);
    expect(next.gold).toBe(15);
  });

  it("supports negative delta", () => {
    const state = makeTestBattleState({ gold: 50 });
    const next = addGold(state, -20);
    expect(next.gold).toBe(30);
  });

  it("does not mutate the original state", () => {
    const state = makeTestBattleState({ gold: 10 });
    addGold(state, 5);
    expect(state.gold).toBe(10);
  });
});

describe("setFlag", () => {
  it("sets a boolean flag", () => {
    const state = makeTestBattleState();
    const next = setFlag(state, "firstHolyCardFreeUsed", true);
    expect(next.flags.firstHolyCardFreeUsed).toBe(true);
  });

  it("sets a numeric flag", () => {
    const state = makeTestBattleState();
    const next = setFlag(state, "nextCardCostReduction", 3);
    expect(next.flags.nextCardCostReduction).toBe(3);
  });

  it("does not mutate the original state", () => {
    const state = makeTestBattleState();
    const next = setFlag(state, "firstBurnCardDoubledUsed", true);
    expect(state.flags.firstBurnCardDoubledUsed).toBe(false);
    expect(next.flags.firstBurnCardDoubledUsed).toBe(true);
  });

  it("preserves other flags", () => {
    const state = makeTestBattleState({
      flags: { ...makeTestBattleState().flags, firstArmorCardDoubledUsed: true },
    });
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

describe("applyPlayerHealing", () => {
  it("increases player health", () => {
    const state = makeTestBattleState({ playerHealth: 15 });
    const next = applyPlayerHealing(state, 10);
    expect(next.playerHealth).toBe(25);
  });

  it("caps at max health", () => {
    const state = makeTestBattleState({ playerHealth: 28 });
    const next = applyPlayerHealing(state, 10);
    expect(next.playerHealth).toBe(30);
  });

  it("preserves Death's Door when healing while active", () => {
    const state = makeTestBattleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 3,
    });
    const next = applyPlayerHealing(state, 5);
    expect(next.playerHealth).toBe(6);
    expect(next.deathsDoorActive).toBe(true);
    expect(next.deathsDoorTriggeredTurn).toBe(3);
  });

  it("preserves Death's Door active when heal amount is 0", () => {
    const state = makeTestBattleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 3,
    });
    const next = applyPlayerHealing(state, 0);
    expect(next.playerHealth).toBe(1);
    expect(next.deathsDoorActive).toBe(true);
  });

  it("does not mutate original state", () => {
    const state = makeTestBattleState({ playerHealth: 10 });
    applyPlayerHealing(state, 5);
    expect(state.playerHealth).toBe(10);
  });

  it("converts overhealing to block if overhealToBlockRatio talent is active", () => {
    const state = makeTestBattleState({
      playerHealth: 25,
      playerMaxHealth: 30,
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 2 },
      talentEffects: { ...makeTestBattleState().talentEffects, overhealToBlockRatio: 0.5 },
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
