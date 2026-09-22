import { battleSnapshot, defaultBattleState, type BattleSnapshot } from "@/lib/battle";
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

function mergeRecord<T extends object>(defaults: T, saved: Partial<T> | undefined): T {
  return { ...defaults, ...saved };
}

function normalizeTalentEffects(
  defaults: TalentEffectManifest,
  saved: Partial<TalentEffectManifest> | undefined,
): TalentEffectManifest {
  const merged = mergeRecord(defaults, saved);
  if (!Array.isArray(merged.healthThresholdArmor)) merged.healthThresholdArmor = [];
  const savedRecord = saved ?? {};
  merged.wishExtraChoiceAfterHolyCard = savedRecord.wishExtraChoiceAfterHolyCard === true;
  merged.leechCardDamageVsLowHealthPercent = clampNonNegative(merged.leechCardDamageVsLowHealthPercent, 0);
  return merged;
}

function clampNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Module-level catalog snapshot for trait restore; stale under HMR/catalog
// swaps, which is acceptable for load-time repair (fresh import per load).
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
    // Native traits are restored from the catalog below; persisted copies are
    // dropped to avoid stale tuning. trinket-hoarder is retired from the
    // catalog but still dropped here to keep old saves loadable.
    if (
      enemy &&
      !Object.hasOwn(ENCOUNTER_TRAITS, trait.id) &&
      (traitMetadata.has(trait.id) || trait.id === "trinket-hoarder")
    )
      return [];
    const canonical = traitMetadata.get(trait.id);
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
  return [
    ...new Map(
      sanitizePersistedEnemyTraits([...(enemy?.traits ?? []), ...traits]).map((trait) => [trait.id, trait]),
    ).values(),
  ];
}

export function normalizePersistedBattleState(saved: Partial<BattleSnapshot>): BattleSnapshot {
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
  const merged: BattleSnapshot = {
    ...defaults,
    ...battleSnapshot({ ...defaults, ...saved }),
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
    pendingForgeThresholds: saved.pendingForgeThresholds ?? defaults.pendingForgeThresholds,
    currentEnemy: {
      ...defaults.currentEnemy,
      ...saved.currentEnemy,
      abilityIds,
      traits: restoreEnemyTraits(saved.currentEnemy?.traits, catalogEnemy),
    },
  };
  // battleMetrics is runtime-only telemetry; never persisted.
  delete merged.battleMetrics;
  merged.lastEnemyAbilityId =
    typeof saved.lastEnemyAbilityId === "string" && abilityIds.includes(saved.lastEnemyAbilityId)
      ? saved.lastEnemyAbilityId
      : null;

  const savedFlags: Record<string, unknown> = saved.flags ?? {};
  // Only these transient signals require an exact boolean; every other saved
  // flag keeps its persisted value via the manifest merge above.
  for (const key of [
    "hawkEyeReady",
    "verdictGoldPaid",
    "pendingCinderSkinReaction",
    "nextWishExtraChoice",
    "previousCardWasArchery",
    "previousCardWasNature",
    "firstBurnCardFreeUsed",
    "archerySecondCardActive",
  ] as const) {
    merged.flags[key] = savedFlags[key] === true;
  }
  for (const key of [
    "companionNextAttackBonus",
    "sanguinePhysicalBonus",
    "darkRecoveryMana",
    "pendingWishMana",
    "archeryCardsPlayedThisTurn",
  ] as const) {
    merged.flags[key] = clampNonNegative(merged.flags[key], 0);
  }
  for (const key of ["playerDodgeCount", "dodgeChanceFromDamage"] as const) {
    merged[key] = clampNonNegative(merged[key], 0);
  }
  for (const key of ["playerHealth", "enemyHealth", "playerMaxHealth", "enemyMaxHealth", "gold"] as const) {
    merged[key] = clampNonNegative(merged[key], defaults[key]);
  }
  // Load-path truncation (not battle Math.round): turn must stay an integer ≥1.
  merged.turn = Number.isFinite(merged.turn) && merged.turn >= 1 ? Math.trunc(merged.turn) : defaults.turn;
  return merged;
}

export function repairPersistedTrinketManifest(battleState: BattleSnapshot, runBoons: string[]): BattleSnapshot {
  if (runBoons.length === 0) return battleState;
  if (!isDefaultTrinketManifest(battleState.trinketEffects)) return battleState;
  return {
    ...battleState,
    trinketEffects: computeTrinketManifest(runBoons),
  };
}
