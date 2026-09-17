import { describe, expect, it } from "vitest";
import {
  decayHalvedStatus,
  decayPoisonStacks,
  decayArmorAfterDamage,
  getEnemyDamageMultiplier,
} from "@/lib/battle/status-helpers";
import { rollPercent } from "@/lib/rng";
import { BATTLE_CONFIG, PERCENT_DENOMINATOR, TRAIT_DAMAGE_RULES } from "@/lib/game-constants";
import type { CombatTextEvent } from "@/lib/battle/types";
import { patchBattleState } from "../../fixtures/battle";
import {
  defaultCcState,
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
    const state = patchBattleState({
      enemyCC: { stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 0 },
      talentEffects: { freezeDoubleDamage: true },
    });
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 1 when no multipliers apply", () => {
    const state = patchBattleState();
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2x when stunDoubleDamage is active and enemy is stunned", () => {
    const state = patchBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, stunDoubleDamage: true },
    });
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(2);
  });

  it("returns 2x when freezeDoubleDamage is active and enemy is frozen", () => {
    const state = patchBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, freezeDoubleDamage: true },
    });
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(2);
  });

  it("returns 4x when both stun and freeze double damage are active", () => {
    const state = patchBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1, freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, stunDoubleDamage: true, freezeDoubleDamage: true },
    });
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(4);
  });

  it("combines trait weakness with stun/freeze multipliers", () => {
    const state = patchBattleState({
      enemyCC: defaultCcState({ stunSkipTurns: 1, freezeSkipTurns: 1 }),
      talentEffects: { ...defaultTalentEffects, stunDoubleDamage: true, freezeDoubleDamage: true },
      currentEnemy: {
        id: "brittle-skeleton",
        title: "Brittle Skeleton",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "holy-vulnerability", title: "Unholy Bones", description: "Receives double Holy damage" }],
        abilityIds: ["slash", "bash", "block"],
      },
    });
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(8);
  });

  it("applies every TRAIT_DAMAGE_RULES multiplier", () => {
    const base = patchBattleState();
    for (const rule of TRAIT_DAMAGE_RULES) {
      const state = patchBattleState({
        currentEnemy: {
          ...base.currentEnemy,
          traits: [{ id: rule.traitId, title: rule.traitId, description: "" }],
        },
      });
      expect(getEnemyDamageMultiplier(state, rule.damageType), rule.traitId).toBe(rule.multiplier);
    }
  });
});

describe("rollPercent", () => {
  it("returns true when random value is below chance threshold", () => {
    expect(rollPercent(50, () => 0.49 / PERCENT_DENOMINATOR)).toBe(true);
  });

  it("returns false when random value is above chance threshold", () => {
    expect(rollPercent(50, () => 0.99)).toBe(false);
  });

  it("returns false for 0 chance", () => {
    expect(rollPercent(0, () => 0.5)).toBe(false);
  });

  it("triggers at exact boundary values", () => {
    expect(rollPercent(50, () => 49 / PERCENT_DENOMINATOR)).toBe(true);
    expect(rollPercent(50, () => 50 / PERCENT_DENOMINATOR)).toBe(false);
  });
});

describe("decayArmorAfterDamage", () => {
  describe("enemy armor decay", () => {
    it("decays enemy armor by ARMOR_DECAY_AMOUNT when damage > 0", () => {
      const state = patchBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(5 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
    });

    it("does not decay enemy armor when damage is 0", () => {
      const state = patchBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 0, "enemy");
      expect(result).toBe(state);
    });

    it("does not decay enemy armor when already 0", () => {
      const state = patchBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 0, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("clamps enemy armor to 0 (does not go negative)", () => {
      const state = patchBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 1, forge: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "enemy");
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("does not mutate original state for enemy decay", () => {
      const state = patchBattleState({
        enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      });
      decayArmorAfterDamage(state, 3, "enemy");
      expect(state.enemyMitigation.armor).toBe(5);
    });
  });

  describe("player armor decay", () => {
    it("decays player armor by ARMOR_DECAY_AMOUNT when damage > 0", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 5 }),
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(5 - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
    });

    it("does not decay player armor when damage is 0", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 5 }),
      });
      const result = decayArmorAfterDamage(state, 0, "player");
      expect(result).toBe(state);
    });

    it("does not decay player armor when armor is already 0", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(0);
    });

    it("does not mutate original state", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 5 }),
      });
      decayArmorAfterDamage(state, 3, "player");
      expect(state.playerStatuses.armor).toBe(5);
    });
  });

  describe("armorBreakBlock talent on player armor break", () => {
    it("grants block when armor breaks and armorBreakBlock talent is active", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 1 }),
        talentEffects: { ...defaultTalentEffects, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(0);
      expect(result.playerStatuses.block).toBe(4);
      expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 4 }]);
    });

    it("includes flatBlockGained when armor breaks", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 1 }),
        talentEffects: { ...defaultTalentEffects, armorBreakBlock: 4 },
        gearEffects: { flatBlockGained: 2 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.block).toBe(6);
      expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 6 }]);
    });

    it("does not grant block when armor does not break (still positive after decay)", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 5 }),
        talentEffects: { ...defaultTalentEffects, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(4);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });

    it("does not grant block when armorBreakBlock is 0", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 1 }),
        talentEffects: { ...defaultTalentEffects, armorBreakBlock: 0 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.armor).toBe(0);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });

    it("does not emit combat text when texts array is not provided", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 1 }),
        talentEffects: { ...defaultTalentEffects, armorBreakBlock: 4 },
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.block).toBe(4);
    });

    it("clamps player armor to 0 when decay exceeds current", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 0 }),
      });
      const result = decayArmorAfterDamage(state, 3, "player");
      expect(result.playerStatuses.armor).toBe(0);
    });

    it("does not grant armorBreakBlock when armor was already 0", () => {
      const state = patchBattleState({
        playerStatuses: defaultPlayerStatusValues({ armor: 0 }),
        talentEffects: { ...defaultTalentEffects, armorBreakBlock: 4 },
      });
      const texts: CombatTextEvent[] = [];
      const result = decayArmorAfterDamage(state, 3, "player", texts);
      expect(result.playerStatuses.block).toBe(0);
      expect(texts).toEqual([]);
    });
  });
});
