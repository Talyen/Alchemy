import { defaultBattleState, type BattleState } from "@/lib/battle";
import {
  findEnemyAbilityCard,
  enemyById,
  enemyBestiary,
  isEnemyId,
  type BestiaryEntry,
  type EnemyTrait,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { computeTrinketManifest, isDefaultTrinketManifest } from "@/lib/trinkets";
import {
  ENCOUNTER_TRAITS,
  sanitizeEncounterTraitIds,
  sanitizePersistedEnemyTraits,
} from "@/lib/content-systems/encounter-traits";
import {
  LEGACY_BLEED_EXECUTE_MULTIPLIER,
  LEGACY_FIRST_BURN_BONUS_MULTIPLIER,
  LEGACY_MANABURN_PER_CRYSTAL_ENABLED,
  LEGACY_WISH_BLOCK_AMOUNT,
  MANABURN_DAMAGE_PERCENT,
} from "@/lib/game-constants";

const RESTING_WORLD_RNG = (): number => {
  throw new Error("Battle world RNG must be drawn inside dispatchRunSessionCommand via withDraftWorldBattleRng");
};

function restingWorldRng(): () => number {
  return RESTING_WORLD_RNG;
}

function mergeRecord<T extends object>(defaults: T, saved: Partial<T> | undefined): T {
  return { ...defaults, ...saved };
}

function normalizeTalentEffects(
  defaults: TalentEffectManifest,
  saved: Partial<TalentEffectManifest> | undefined,
): TalentEffectManifest {
  const merged = mergeRecord(defaults, saved);
  if (!Array.isArray(merged.healthThresholdArmor)) {
    const legacy = merged.healthThresholdArmor as unknown;
    merged.healthThresholdArmor =
      legacy && typeof legacy === "object" ? [legacy as TalentEffectManifest["healthThresholdArmor"][number]] : [];
  }
  const savedRecord = (saved ?? {}) as Partial<TalentEffectManifest> & {
    firstBurnCardDoubled?: boolean;
    receiveHalfFreezeBuildUp?: boolean;
  };
  if (savedRecord.firstBurnCardDoubled === true && (savedRecord.firstBurnCardBonusMultiplier ?? 0) <= 0) {
    merged.firstBurnCardBonusMultiplier = LEGACY_FIRST_BURN_BONUS_MULTIPLIER;
  }
  if (savedRecord.receiveHalfFreezeBuildUp === true) {
    merged.receiveHalfFreezeDamage = true;
  }
  if ((savedRecord.bleedExecuteThreshold ?? 0) > 0 && !("bleedExecuteMultiplier" in savedRecord)) {
    merged.bleedExecuteMultiplier = LEGACY_BLEED_EXECUTE_MULTIPLIER;
  }
  if ((savedRecord.wishBlockBelowHealthPct ?? 0) > 0 && !("wishBlockAmount" in savedRecord)) {
    merged.wishBlockAmount = LEGACY_WISH_BLOCK_AMOUNT;
  }

  if (savedRecord.burnDamagePerManaCrystal === LEGACY_MANABURN_PER_CRYSTAL_ENABLED) {
    merged.burnDamagePerManaCrystal = MANABURN_DAMAGE_PERCENT;
  }
  return merged;
}

function clampNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const traitMetadata = new Map(
  [
    ...enemyBestiary.flatMap((enemy) => enemy.traits),
    ...Object.values(ENCOUNTER_TRAITS).map((trait) => trait.enemyTrait),
  ].map((trait) => [trait.id, trait]),
);

function restoreEnemyTraits(value: unknown, enemy: BestiaryEntry | undefined): EnemyTrait[] {
  if (!Array.isArray(value)) return enemy?.traits ?? [];
  const traits = value.flatMap((trait: unknown): EnemyTrait[] => {
    if (!trait || typeof trait !== "object" || !("id" in trait) || typeof trait.id !== "string") return [];
    const canonical = enemy?.traits.find((entry) => entry.id === trait.id) ?? traitMetadata.get(trait.id);
    if (canonical) return [canonical];
    if (
      !("title" in trait) ||
      typeof trait.title !== "string" ||
      !("description" in trait) ||
      typeof trait.description !== "string"
    )
      return [];
    return [{ id: trait.id, title: trait.title, description: trait.description }];
  });
  return sanitizePersistedEnemyTraits(traits);
}

export function normalizePersistedBattleState(saved: Partial<BattleState>): BattleState {
  const defaults = defaultBattleState();
  const savedEnemy = saved.currentEnemy;
  const catalogEnemy = savedEnemy && isEnemyId(savedEnemy.id) ? enemyById[savedEnemy.id] : undefined;
  const savedAbilityIds = savedEnemy?.abilityIds;
  const abilityIds =
    Array.isArray(savedAbilityIds) &&
    savedAbilityIds.length === 3 &&
    new Set(savedAbilityIds).size === 3 &&
    savedAbilityIds.every((id) => typeof id === "string" && findEnemyAbilityCard(id))
      ? savedAbilityIds
      : (catalogEnemy?.abilityIds ?? defaults.currentEnemy.abilityIds);
  const merged: BattleState = {
    ...defaults,
    ...saved,
    encounterBenefits:
      saved.contentSystemType === "labyrinth" && Array.isArray(saved.encounterBenefits)
        ? sanitizeEncounterTraitIds(saved.encounterBenefits, "reward")
        : [],
    trinketEffects: mergeRecord(defaults.trinketEffects, saved.trinketEffects),
    gearEffects: mergeRecord(defaults.gearEffects, saved.gearEffects),
    talentEffects: normalizeTalentEffects(defaults.talentEffects, saved.talentEffects),
    flags: mergeRecord(defaults.flags, saved.flags),
    uniqueGear: mergeRecord(defaults.uniqueGear, saved.uniqueGear),
    playerStatuses: mergeRecord(defaults.playerStatuses, saved.playerStatuses),
    enemyStatuses: mergeRecord(defaults.enemyStatuses, saved.enemyStatuses),
    playerCC: mergeRecord(defaults.playerCC, saved.playerCC),
    enemyCC: mergeRecord(defaults.enemyCC, saved.enemyCC),
    enemyMitigation: mergeRecord(defaults.enemyMitigation, saved.enemyMitigation),
    pendingTurnStartEffects: saved.pendingTurnStartEffects ?? defaults.pendingTurnStartEffects,
    currentEnemy: {
      ...defaults.currentEnemy,
      ...saved.currentEnemy,
      abilityIds,
      traits: restoreEnemyTraits(saved.currentEnemy?.traits, catalogEnemy),
    },
  };
  delete merged.battleMetrics;
  merged.lastEnemyAbilityId =
    typeof saved.lastEnemyAbilityId === "string" && abilityIds.includes(saved.lastEnemyAbilityId)
      ? saved.lastEnemyAbilityId
      : null;

  merged.rng = typeof saved.rng === "function" ? saved.rng : restingWorldRng();

  const savedFlags: Record<string, unknown> = saved.flags ?? {};
  if (!("legacyEnemyThornsReady" in savedFlags)) {
    merged.flags.legacyEnemyThornsReady =
      merged.currentEnemy.traits.some((trait) => trait.id === "thorns") && merged.enemyStatuses.thorns > 0;
  }
  merged.flags.pendingCinderSkinReaction = savedFlags.pendingCinderSkinReaction === true;
  merged.flags.previousCardWasArchery = savedFlags.previousCardWasArchery === true;
  merged.flags.previousCardWasNature = savedFlags.previousCardWasNature === true;
  merged.flags.companionNextAttackBonus = clampNonNegative(merged.flags.companionNextAttackBonus, 0);
  merged.flags.sanguinePhysicalBonus = clampNonNegative(merged.flags.sanguinePhysicalBonus, 0);
  merged.flags.darkRecoveryMana = clampNonNegative(merged.flags.darkRecoveryMana, 0);
  merged.flags.pendingWishMana = clampNonNegative(merged.flags.pendingWishMana, 0);
  merged.playerDodgeCount = clampNonNegative(merged.playerDodgeCount, 0);
  merged.dodgeChanceFromDamage = clampNonNegative(merged.dodgeChanceFromDamage, 0);
  merged.playerHealth = clampNonNegative(merged.playerHealth, defaults.playerHealth);
  merged.enemyHealth = clampNonNegative(merged.enemyHealth, defaults.enemyHealth);
  merged.playerMaxHealth = clampNonNegative(merged.playerMaxHealth, defaults.playerMaxHealth);
  merged.enemyMaxHealth = clampNonNegative(merged.enemyMaxHealth, defaults.enemyMaxHealth);
  merged.gold = clampNonNegative(merged.gold, defaults.gold);
  merged.turn = Number.isFinite(merged.turn) && merged.turn >= 1 ? Math.trunc(merged.turn) : defaults.turn;
  return merged;
}

export function repairPersistedTrinketManifest(battleState: BattleState, runBoons: string[]): BattleState {
  if (runBoons.length === 0) return battleState;
  if (!isDefaultTrinketManifest(battleState.trinketEffects)) return battleState;
  return {
    ...battleState,
    trinketEffects: computeTrinketManifest(runBoons),
  };
}
