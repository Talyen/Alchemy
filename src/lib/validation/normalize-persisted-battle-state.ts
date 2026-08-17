// Deep-merge persisted battle snapshots with defaultBattleState() so resumed
// combat recovers manifests and flags stripped by JSON save/load.
import { defaultBattleState, type BattleState } from "@/lib/battle";
import type { TalentEffectManifest } from "@/lib/game-data";
import { sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";
import { LEGACY_MANABURN_PER_CRYSTAL_ENABLED, MANABURN_DAMAGE_PERCENT } from "@/lib/game-constants";

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
    merged.firstBurnCardBonusMultiplier = 1.5;
  }
  if (savedRecord.receiveHalfFreezeBuildUp === true) {
    merged.receiveHalfFreezeDamage = true;
  }
  if ((savedRecord.bleedExecuteThreshold ?? 0) > 0 && !("bleedExecuteMultiplier" in savedRecord)) {
    merged.bleedExecuteMultiplier = 2;
  }
  if ((savedRecord.wishBlockBelowHealthPct ?? 0) > 0 && !("wishBlockAmount" in savedRecord)) {
    merged.wishBlockAmount = 6;
  }
  // Pre-percent Manaburn snapshots stored 1 (= enabled). Current combat stores the percent.
  if (savedRecord.burnDamagePerManaCrystal === LEGACY_MANABURN_PER_CRYSTAL_ENABLED) {
    merged.burnDamagePerManaCrystal = MANABURN_DAMAGE_PERCENT;
  }
  return merged;
}

/** Wire input may omit fields that defaults fill; cast is intentional at the persistence boundary. */
export function normalizePersistedBattleState(saved: Partial<BattleState>): BattleState {
  const defaults = defaultBattleState();
  return {
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
}
