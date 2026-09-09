import { describe, expect, it } from "vitest";
import { initializeEnemyState, scaleEnemyAbilityDamage } from "@/lib/battle/battle-enemy-setup";
import { enemyBestiary, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import {
  BASE_ENEMY_HEALTH,
  BOSS_HEALTH_MULTIPLIER,
  ELITE_HP_MULTIPLIER,
  ENEMY_BOSS_REGENERATION,
  ENEMY_BASE_REGENERATION,
  ENEMY_STARTING_BLOCK,
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
    const physical = scaleEnemyAbilityDamage(
      { roomScalingMultiplier: roomMul, difficultyModifiers: [] },
      { kind: "damage", damageType: "physical", amount: 6 },
    );
    expect(physical.amount).toBe(Math.round(6 * roomMul));
  });

  it("multiplies max health with enemy-health-multiplier", () => {
    const mods: DifficultyModifier[] = [{ kind: "enemy-health-multiplier", amount: 1.5 }];
    const base = initializeEnemyState(skeleton, 1, []);
    const result = initializeEnemyState(skeleton, 1, mods);
    expect(result.enemyMaxHealth).toBe(Math.round(base.enemyMaxHealth * 1.5));
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
      { kind: "start-companion" },
    ];
    const result = initializeEnemyState(skeleton, 1, mods);
    expect(result.startBlock).toBe(4);
    expect(result.manaBonus).toBe(1);
    expect(result.startCompanion).toBe(true);
    expect(result.startCompanionId).toBe("wolf");
  });

  it("respects companionId on start-companion modifier", () => {
    const mods: DifficultyModifier[] = [{ kind: "start-companion", companionId: "phoenix" }];
    const result = initializeEnemyState(skeleton, 1, mods);
    expect(result.startCompanion).toBe(true);
    expect(result.startCompanionId).toBe("phoenix");
  });

  it("stacks modifier starting armor with trait armor", () => {
    const mods: DifficultyModifier[] = [{ kind: "enemy-starting-armor", amount: 3 }];
    const result = initializeEnemyState(livingArmor, 1, mods);
    expect(result.startingArmor).toBe(3 + LIVING_ARMOR_STARTING_ARMOR);
  });
});
