import { describe, expect, it, vi } from "vitest";
import {
  decayHalvedStatus,
  decayPoisonStacks,
  rollPercent,
  decayArmorAfterDamage,
  getEnemyDamageMultiplier,
} from "@/lib/battle/status-helpers";
import { BATTLE_CONFIG, PERCENT_DENOMINATOR } from "@/lib/game-constants";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";
import {
  defaultPlayerStatusValues,
  defaultEnemyMitigation,
  defaultTalentEffects,
} from "../../fixtures/default-battle-state";

describe("decayHalvedStatus", () => {
  it("returns 0 for value 0", () => {
    expect(decayHalvedStatus(0)).toBe(0);
  });

  it("returns 0 for value 1 (<= threshold)", () => {
    expect(decayHalvedStatus(1)).toBe(0);
  });

  it("halves even values", () => {
    expect(decayHalvedStatus(10)).toBe(5);
    expect(decayHalvedStatus(4)).toBe(2);
    expect(decayHalvedStatus(2)).toBe(1);
  });

  it("rounds odd values down via Math.round", () => {
    expect(decayHalvedStatus(3)).toBe(2);
    expect(decayHalvedStatus(5)).toBe(3);
    expect(decayHalvedStatus(7)).toBe(4);
  });

  it("handles large values", () => {
    expect(decayHalvedStatus(100)).toBe(50);
    expect(decayHalvedStatus(99)).toBe(50);
  });
});

describe("decayPoisonStacks", () => {
  it("returns 0 for 0 stacks", () => {
    expect(decayPoisonStacks(0)).toBe(0);
  });

  it("returns 0 for negative stacks", () => {
    expect(decayPoisonStacks(-1)).toBe(0);
  });

  it("decays stacks by percent, min 1 lost", () => {
    expect(decayPoisonStacks(10)).toBeLessThan(10);
    expect(decayPoisonStacks(1)).toBe(0);
  });

  it("decays at least 1 stack even when percent decay rounds to 0", () => {
    expect(decayPoisonStacks(1)).toBe(0);
    expect(decayPoisonStacks(2)).toBe(1);
  });
});

describe("getEnemyDamageMultiplier", () => {
  it("does not activate freezeDoubleDamage when freezeSkipTurns is 0", () => {
    const state = createTestBattleState({
      enemyCC: { stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, freezeDoubleDamage: true },
    });
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });
});

describe("rollPercent", () => {
  it("returns true when random value is below chance threshold", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.49 / PERCENT_DENOMINATOR);
    expect(rollPercent(50, Math.random)).toBe(true);
  });

  it("returns false when random value is above chance threshold", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99);
    expect(rollPercent(50, Math.random)).toBe(false);
  });

  it("returns false for 0 chance", () => {
    expect(rollPercent(0, Math.random)).toBe(false);
  });

  it("triggers at exact boundary values", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(49 / PERCENT_DENOMINATOR);
    expect(rollPercent(50, Math.random)).toBe(true);
    vi.spyOn(Math, "random").mockReturnValueOnce(50 / PERCENT_DENOMINATOR);
    expect(rollPercent(50, Math.random)).toBe(false);
  });
});

describe("decayArmorAfterDamage", () => {
  describe("enemy armor decay", () => {
    it("decays enemy armor by ARMOR_DECAY_AMOUNT when damage > 0", () => {
      const state = createTestBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(5 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
    });

    it("does not decay enemy armor when damage is 0", () => {
      const state = createTestBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 0, "enemy");
      expect(result).toBe(state);
    });

    it("does not decay enemy armor when already 0", () => {
      const state = createTestBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 0, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("clamps enemy armor to 0 (does not go negative)", () => {
      const state = createTestBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 1, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("does not mutate original state for enemy decay", () => {
      const state = createTestBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      });
      decayArmorAfterDamage(state, 3, "enemy");
      expect(state.enemyMitigation.armor).toBe(5);
    });
  });

  describe("player armor decay", () => {
    it("decays player armor by ARMOR_DECAY_AMOUNT when damage > 0", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 5 }),
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(5 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
    });

    it("does not decay player armor when damage is 0", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 5 }),
      });
      const result = decayArmorAfterDamage(state, 0, "player");
      expect(result).toBe(state);
    });

    it("does not decay player armor when armor is already 0", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(0);
    });

    it("does not mutate original state", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 5 }),
      });
      decayArmorAfterDamage(state, 3, "player");
      expect(state.playerStatuses.armor).toBe(5);
    });
  });

  describe("armorBreakBlock talent on player armor break", () => {
    it("grants block when armor breaks and armorBreakBlock talent is active", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 1 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(0);
      expect(result.playerStatuses.block).toBe(4);
      expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 4 }]);
    });

    it("does not grant block when armor does not break (still positive after decay)", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 5 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(4);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });

    it("does not grant block when armorBreakBlock is 0", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 1 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, armorBreakBlock: 0 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(0);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });

    it("does not emit combat text when texts array is not provided", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 1 }),
        talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, armorBreakBlock: 4 },
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.block).toBe(4);
    });

    it("clamps player armor to 0 when decay exceeds current", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(0);
    });

    it("does not grant armorBreakBlock when armor was already 0", () => {
      const state = createTestBattleState({
        playerStatuses: defaultPlayerStatusValues({ ...createTestBattleState().playerStatuses, armor: 0 }),
        talentEffects: { ...createTestBattleState().talentEffects, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });
  });
});
