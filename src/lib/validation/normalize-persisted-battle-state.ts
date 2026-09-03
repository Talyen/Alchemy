import { defaultBattleState, type BattleState } from "@/lib/battle";
import type { TalentEffectManifest } from "@/lib/game-data";
import { computeTrinketManifest, isDefaultTrinketManifest } from "@/lib/trinkets";
import { sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";
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

export function normalizePersistedBattleState(saved: Partial<BattleState>): BattleState {
  const defaults = defaultBattleState();
  const merged: BattleState = {
    ...defaults,
    ...saved,
    trinketEffects: mergeRecord(defaults.trinketEffects, saved.trinketEffects),
    gearEffects: mergeRecord(defaults.gearEffects, saved.gearEffects),
    talentEffects: normalizeTalentEffects(defaults.talentEffects, saved.talentEffects),
    flags: mergeRecord(defaults.flags, saved.flags),
    playerStatuses: mergeRecord(defaults.playerStatuses, saved.playerStatuses),
    enemyStatuses: mergeRecord(defaults.enemyStatuses, saved.enemyStatuses),
    playerCC: mergeRecord(defaults.playerCC, saved.playerCC),
    enemyCC: mergeRecord(defaults.enemyCC, saved.enemyCC),
    enemyMitigation: mergeRecord(defaults.enemyMitigation, saved.enemyMitigation),
    pendingTurnStartEffects: saved.pendingTurnStartEffects ?? defaults.pendingTurnStartEffects,
    currentEnemy: {
      ...defaults.currentEnemy,
      ...saved.currentEnemy,
      traits: sanitizePersistedEnemyTraits(Array.isArray(saved.currentEnemy?.traits) ? saved.currentEnemy.traits : []),
    },
  };

  merged.rng =
    (saved as { rng?: unknown }).rng != null && typeof (saved as { rng?: unknown }).rng === "function"
      ? (saved as unknown as { rng: () => number }).rng
      : restingWorldRng();

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
