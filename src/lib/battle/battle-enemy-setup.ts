/**
 * Enemy scaling, difficulty attack modifiers, and battle-start enemy setup.
 */
import type { BestiaryEntry, DifficultyModifier, EnemyAttackEffect } from "@/lib/game-data";
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

function scaleAttackEffects(effects: EnemyAttackEffect[], roomMul: number): EnemyAttackEffect[] {
  return effects.map((effect) => {
    const scaledAmount = Math.round(effect.amount * roomMul);
    if (effect.kind === "damage") {
      return {
        kind: "damage",
        damageType: effect.damageType,
        amount: scaledAmount,
        ...(effect.lifesteal !== undefined ? { lifesteal: effect.lifesteal } : {}),
      };
    }
    return { kind: "player-status", status: effect.status, amount: scaledAmount };
  });
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
    scaledEnemyAttackEffects: scaleAttackEffects(enemy.attackEffects, roomMul),
    enemyRegeneration: scaleEnemyRegeneration(enemy, roomMul),
  };
}

function applyDifficultyAttackModifiers(effects: EnemyAttackEffect[], modifiers: DifficultyModifier[]) {
  const dmgMul = modifiers.find((m) => m.kind === "enemy-damage-multiplier")?.amount ?? 1;
  const damageBonus = modifiers
    .filter((m) => m.kind === "increase-enemy-physical-damage" || m.kind === "increase-enemy-damage")
    .reduce((sum, m) => sum + m.amount, 0);
  const statusBonusById = new Map<string, number>();
  for (const mod of modifiers) {
    if (mod.kind === "increase-enemy-status") {
      statusBonusById.set(mod.status, (statusBonusById.get(mod.status) ?? 0) + mod.amount);
    }
  }
  const attacksGainLeech = modifiers.some((m) => m.kind === "enemy-attacks-gain-leech");

  return effects.map((effect) => {
    if (effect.kind === "damage") {
      let amount = effect.amount;
      if (dmgMul !== 1) amount = Math.round(amount * dmgMul);
      if (damageBonus) amount += damageBonus;
      if (effect.damageType === "stun" || effect.damageType === "freeze") {
        amount += statusBonusById.get(effect.damageType) ?? 0;
      }
      return {
        ...effect,
        amount,
        ...(attacksGainLeech ? { lifesteal: true } : {}),
      };
    }
    const statusBonus = statusBonusById.get(effect.status) ?? 0;
    if (statusBonus) {
      return { ...effect, amount: effect.amount + statusBonus };
    }
    return effect;
  });
}

function isStartCompanionMod(mod: DifficultyModifier): mod is Extract<DifficultyModifier, { kind: "start-companion" }> {
  return mod.kind === "start-companion";
}

function computeStartingStatuses(modifiers: DifficultyModifier[], enemy: BestiaryEntry, roomMul: number) {
  const startingArmor = modifiers.find((m) => m.kind === "enemy-starting-armor")?.amount ?? 0;
  const traitStartingArmor = enemy.traits.some((t) => t.id === "living-armor")
    ? Math.round(LIVING_ARMOR_STARTING_ARMOR * roomMul)
    : 0;
  const startBlock = modifiers.find((m) => m.kind === "start-block")?.amount ?? 0;
  const manaBonus = modifiers.find((m) => m.kind === "start-max-mana")?.amount ?? 0;
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
  const { scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration, roomMul } = buildScaledEnemy(
    battleEnemy,
    battleRooms,
  );
  const modifiedEffects = applyDifficultyAttackModifiers(scaledEnemyAttackEffects, battleDiffs);
  const { startingArmor, startBlock, manaBonus, startCompanion, startCompanionId, startingEnemyBlock } =
    computeStartingStatuses(battleDiffs, battleEnemy, roomMul);

  const hpMul = battleDiffs.find((m) => m.kind === "enemy-health-multiplier")?.amount ?? 1;
  const enemyMaxHealth = Math.round(scaledEnemyHealth * hpMul);

  return {
    enemyMaxHealth,
    modifiedEffects,
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
