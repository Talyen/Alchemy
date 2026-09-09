import type { BestiaryEntry, DifficultyModifier, EnemyAbilityDamageEffect } from "@/lib/game-data";
import type { BattleState } from "./types";
import {
  BASE_ENEMY_HEALTH,
  BOSS_HEALTH_MULTIPLIER,
  ELITE_HP_MULTIPLIER,
  ENEMY_BASE_REGENERATION,
  ENEMY_BOSS_REGENERATION,
  ENEMY_STARTING_BLOCK,
  LIVING_ARMOR_STARTING_ARMOR,
  ROOM_SCALING_INCREMENT,
} from "../game-constants";

function scaleEnemyHealth(enemy: BestiaryEntry, roomMul: number): number {
  const hpTypeMul =
    enemy.enemyType === "elite" ? ELITE_HP_MULTIPLIER : enemy.enemyType === "boss" ? BOSS_HEALTH_MULTIPLIER : 1;
  return Math.round(BASE_ENEMY_HEALTH * roomMul * hpTypeMul);
}

function scaleEnemyRegeneration(enemy: BestiaryEntry, roomMul: number): number {
  if (!enemy.traits.some((t) => t.id === "regeneration")) return 0;
  const base = enemy.enemyType === "boss" ? ENEMY_BOSS_REGENERATION : ENEMY_BASE_REGENERATION;
  return Math.round(base * roomMul);
}

function buildScaledEnemy(enemy: BestiaryEntry, totalRoomsInRun = 0) {
  const scaler = Math.max(0, totalRoomsInRun - 1);
  const roomMul = 1 + scaler * ROOM_SCALING_INCREMENT;
  return {
    roomMul,
    scaledEnemyHealth: scaleEnemyHealth(enemy, roomMul),
    enemyRegeneration: scaleEnemyRegeneration(enemy, roomMul),
  };
}

export function scaleEnemyAbilityDamage(
  state: Pick<BattleState, "roomScalingMultiplier" | "difficultyModifiers">,
  effect: EnemyAbilityDamageEffect,
): EnemyAbilityDamageEffect {
  const modifiers = state.difficultyModifiers;
  const damageMultiplier = modifierAmount(modifiers, "enemy-damage-multiplier", 1);
  let amount = Math.round(effect.amount * state.roomScalingMultiplier);
  amount = Math.round(amount * damageMultiplier);
  for (const modifier of modifiers) {
    if (modifier.kind === "increase-enemy-physical-damage" || modifier.kind === "increase-enemy-damage") {
      amount += modifier.amount;
    }
    if (
      modifier.kind === "increase-enemy-status" &&
      (effect.damageType === "stun" || effect.damageType === "freeze") &&
      modifier.status === effect.damageType
    ) {
      amount += modifier.amount;
    }
  }
  return {
    ...effect,
    amount,
    ...(modifiers.some((modifier) => modifier.kind === "enemy-attacks-gain-leech") ? { lifesteal: true } : {}),
  };
}

function isStartCompanionMod(mod: DifficultyModifier): mod is Extract<DifficultyModifier, { kind: "start-companion" }> {
  return mod.kind === "start-companion";
}

function modifierAmount(modifiers: DifficultyModifier[], kind: DifficultyModifier["kind"], fallback = 0): number {
  const found = modifiers.find((m) => m.kind === kind) as { amount?: number } | undefined;
  return found?.amount ?? fallback;
}

function computeStartingStatuses(modifiers: DifficultyModifier[], enemy: BestiaryEntry, roomMul: number) {
  const startingArmor = modifierAmount(modifiers, "enemy-starting-armor");
  const traitStartingArmor = enemy.traits.some((t) => t.id === "living-armor")
    ? Math.round(LIVING_ARMOR_STARTING_ARMOR * roomMul)
    : 0;
  const startBlock = modifierAmount(modifiers, "start-block");
  const manaBonus = modifierAmount(modifiers, "start-max-mana");
  const companionMod = modifiers.find(isStartCompanionMod);
  const startCompanion = Boolean(companionMod);
  const startCompanionId = companionMod?.companionId ?? "wolf";
  const startingEnemyBlock = enemy.traits.some((t) => t.id === "starting-block")
    ? Math.round(ENEMY_STARTING_BLOCK * roomMul)
    : 0;
  return {
    startingArmor: startingArmor + traitStartingArmor,
    startBlock,
    manaBonus,
    startCompanion,
    startCompanionId,
    startingEnemyBlock,
  };
}

export function initializeEnemyState(
  battleEnemy: BestiaryEntry,
  battleRooms: number,
  battleDiffs: DifficultyModifier[],
) {
  const { scaledEnemyHealth, enemyRegeneration, roomMul } = buildScaledEnemy(battleEnemy, battleRooms);
  const { startingArmor, startBlock, manaBonus, startCompanion, startCompanionId, startingEnemyBlock } =
    computeStartingStatuses(battleDiffs, battleEnemy, roomMul);

  const hpMul = modifierAmount(battleDiffs, "enemy-health-multiplier", 1);
  const enemyMaxHealth = Math.round(scaledEnemyHealth * hpMul);

  return {
    enemyMaxHealth,
    enemyRegeneration,
    roomScalingMultiplier: roomMul,
    startingArmor,
    startBlock,
    manaBonus,
    startCompanion,
    startCompanionId,
    startingEnemyBlock,
  };
}
