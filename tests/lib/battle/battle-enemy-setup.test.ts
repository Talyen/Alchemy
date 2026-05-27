import { describe, expect, it } from "vitest";
import { initializeEnemyState } from "@/lib/battle/battle-enemy-setup";
import { enemyBestiary, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import {
  BASE_ENEMY_HEALTH,
  BOSS_HEALTH_MULTIPLIER,
  ELITE_HP_MULTIPLIER,
  ENEMY_BOSS_REGENERATION,
  ENEMY_BASE_REGENERATION,
  ENEMY_STARTING_BLOCK,
  LABYRINTH_STURDY_MULTIPLIER,
  LIVING_ARMOR_STARTING_ARMOR,
  ROOM_SCALING_INCREMENT,
} from "@/lib/game-constants";

function getEnemy(id: string): BestiaryEntry {
  const enemy = enemyBestiary.find((e) => e.id === id);
  if (!enemy) throw new Error(`Missing bestiary entry: ${id}`);
  return enemy;
}

describe("initializeEnemyState", () => {
  const skeleton = getEnemy("skeleton");
  const mimic = getEnemy("mimic");
  const mudElemental = getEnemy("mud-elemental");
  const blightTreant = getEnemy("blight-treant");
  const livingArmor = getEnemy("living-armor");
  const forgeGolem = getEnemy("forge-golem");

  it("scales normal enemy at room 1 to base health and multiplier 1", () => {
    const result = initializeEnemyState(skeleton, 1, []);
    expect(result.enemyMaxHealth).toBe(BASE_ENEMY_HEALTH);
    expect(result.roomScalingMultiplier).toBe(1);
  });

  it("applies elite HP multiplier", () => {
    const result = initializeEnemyState(mimic, 1, []);
    expect(result.enemyMaxHealth).toBe(Math.round(BASE_ENEMY_HEALTH * ELITE_HP_MULTIPLIER));
  });

  it("applies boss HP multiplier and boss regeneration", () => {
    const result = initializeEnemyState(blightTreant, 1, []);
    expect(result.enemyMaxHealth).toBe(Math.round(BASE_ENEMY_HEALTH * BOSS_HEALTH_MULTIPLIER));
    expect(result.enemyRegeneration).toBe(ENEMY_BOSS_REGENERATION);
  });

  it("applies elite regeneration at base rate", () => {
    const result = initializeEnemyState(mudElemental, 1, []);
    expect(result.enemyRegeneration).toBe(ENEMY_BASE_REGENERATION);
  });

  it("scales health and attacks by room count", () => {
    const roomMul = 1 + 4 * ROOM_SCALING_INCREMENT;
    const result = initializeEnemyState(skeleton, 5, []);
    expect(result.roomScalingMultiplier).toBe(roomMul);
    expect(result.enemyMaxHealth).toBe(Math.round(BASE_ENEMY_HEALTH * roomMul));
    const physical = result.modifiedEffects.find((e) => e.kind === "damage" && e.damageType === "physical");
    expect(physical?.kind === "damage" && physical.amount).toBe(Math.round(9 * roomMul));
  });

  it("multiplies max health with enemy-health-multiplier", () => {
    const mods: DifficultyModifier[] = [{ kind: "enemy-health-multiplier", amount: 1.5 }];
    const base = initializeEnemyState(skeleton, 1, []);
    const result = initializeEnemyState(skeleton, 1, mods);
    expect(result.enemyMaxHealth).toBe(Math.round(base.enemyMaxHealth * 1.5));
  });

  it("combines labyrinth-sturdy and enemy-health-multiplier", () => {
    const mods: DifficultyModifier[] = [
      { kind: "labyrinth-sturdy", amount: LABYRINTH_STURDY_MULTIPLIER },
      { kind: "enemy-health-multiplier", amount: 1.2 },
    ];
    const scaled = Math.round(BASE_ENEMY_HEALTH);
    const totalMul = LABYRINTH_STURDY_MULTIPLIER + (1.2 - 1);
    const result = initializeEnemyState(skeleton, 1, mods);
    expect(result.enemyMaxHealth).toBe(Math.round(scaled * totalMul));
  });

  it("increases physical damage from difficulty bonuses", () => {
    const mods: DifficultyModifier[] = [
      { kind: "increase-enemy-physical-damage", amount: 2 },
      { kind: "increase-enemy-damage", amount: 1 },
    ];
    const result = initializeEnemyState(skeleton, 1, mods);
    const physical = result.modifiedEffects.find((e) => e.kind === "damage" && e.damageType === "physical");
    expect(physical?.kind === "damage" && physical.amount).toBe(9 + 2 + 1);
  });

  it("increases matching player-status attack amounts", () => {
    const mods: DifficultyModifier[] = [{ kind: "increase-enemy-status", status: "stun", amount: 2 }];
    const result = initializeEnemyState(forgeGolem, 1, mods);
    const stun = result.modifiedEffects.find((e) => e.kind === "player-status" && e.status === "stun");
    expect(stun?.kind === "player-status" && stun.amount).toBe(3);
  });

  it("adds lifesteal to all damage attacks when enemy-attacks-gain-leech is active", () => {
    const mods: DifficultyModifier[] = [{ kind: "enemy-attacks-gain-leech", amount: 1 }];
    const result = initializeEnemyState(skeleton, 1, mods);
    for (const effect of result.modifiedEffects) {
      if (effect.kind === "damage") expect(effect.lifesteal).toBe(true);
    }
  });

  it("preserves existing lifesteal on scaled damage attacks", () => {
    const leechEnemy: BestiaryEntry = {
      ...skeleton,
      attackEffects: [{ kind: "damage", damageType: "physical", amount: 6, lifesteal: true }],
    };
    const result = initializeEnemyState(leechEnemy, 3, []);
    const physical = result.modifiedEffects[0];
    expect(physical.kind === "damage" && physical.lifesteal).toBe(true);
  });

  it("includes living-armor trait starting armor scaled by room", () => {
    const roomMul = 1 + 2 * ROOM_SCALING_INCREMENT;
    const result = initializeEnemyState(livingArmor, 3, []);
    expect(result.startingArmor).toBe(Math.round(LIVING_ARMOR_STARTING_ARMOR * roomMul));
  });

  it("includes starting-block trait enemy block scaled by room", () => {
    const roomMul = 1 + 2 * ROOM_SCALING_INCREMENT;
    const result = initializeEnemyState(forgeGolem, 3, []);
    expect(result.startingEnemyBlock).toBe(Math.round(ENEMY_STARTING_BLOCK * roomMul));
  });

  it("returns start-block, start-max-mana, and start-companion from modifiers", () => {
    const mods: DifficultyModifier[] = [
      { kind: "start-block", amount: 4 },
      { kind: "start-max-mana", amount: 1 },
      { kind: "start-companion", amount: 1 },
    ];
    const result = initializeEnemyState(skeleton, 1, mods);
    expect(result.startBlock).toBe(4);
    expect(result.manaBonus).toBe(1);
    expect(result.startCompanion).toBe(true);
  });

  it("stacks modifier starting armor with trait armor", () => {
    const mods: DifficultyModifier[] = [{ kind: "enemy-starting-armor", amount: 3 }];
    const result = initializeEnemyState(livingArmor, 1, mods);
    expect(result.startingArmor).toBe(3 + LIVING_ARMOR_STARTING_ARMOR);
  });
});
