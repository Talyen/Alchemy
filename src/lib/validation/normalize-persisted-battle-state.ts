import {
  defaultGearEffects,
  GEAR_NUMERIC_EFFECT_KEYS,
  GEAR_CHANCE_EFFECT_KEYS,
  type GearEffectManifest,
} from "@/lib/gear";
import { battleSnapshot, defaultBattleState, type BattleSnapshot } from "@/lib/battle";
import {
  findEnemyAbilityCard,
  enemyById,
  enemyBestiary,
  companionLibrary,
  isEnemyId,
  type BestiaryEntry,
  type EnemyTrait,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { MAX_HAND_SIZE, MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { toFiniteNonNegativeInt } from "./save-schemas/validation-utils";
import {
  ENCOUNTER_TRAITS,
  sanitizeEncounterTraitIds,
  sanitizePersistedEnemyTraits,
} from "@/lib/content-systems/encounter-traits";

function normalizeGearEffects(saved: Partial<GearEffectManifest> | undefined): GearEffectManifest {
  const result = { ...defaultGearEffects };
  for (const key of GEAR_NUMERIC_EFFECT_KEYS) result[key] = clampNonNegative(saved?.[key] ?? 0, 0);
  for (const key of GEAR_CHANCE_EFFECT_KEYS) {
    const values = saved?.[key];
    result[key] = Array.isArray(values)
      ? values.filter(
          (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100,
        )
      : [];
  }
  return result;
}

function normalizeTalentEffects(
  defaults: TalentEffectManifest,
  saved: Partial<TalentEffectManifest> | undefined,
): TalentEffectManifest {
  const knownSaved = Object.fromEntries(
    Object.entries(saved ?? {}).filter(([key, value]) => {
      if (!Object.hasOwn(defaults, key)) return false;
      const fallback = defaults[key as keyof TalentEffectManifest];
      if (typeof fallback === "number") return typeof value === "number" && Number.isFinite(value);
      if (typeof fallback === "boolean") return typeof value === "boolean";
      return true;
    }),
  ) as Partial<TalentEffectManifest>;
  const merged = { ...defaults, ...knownSaved };
  if (!Array.isArray(merged.healthThresholdArmor)) merged.healthThresholdArmor = [];
  merged.leechCardDamageVsLowHealthPercent = clampNonNegative(merged.leechCardDamageVsLowHealthPercent, 0);
  return merged;
}

function clampNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeNonNegativeRecord<K extends string>(
  defaults: Record<K, number>,
  saved: Partial<Record<K, number>> | undefined,
): Record<K, number> {
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as K[]) {
    const value = saved?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) merged[key] = value;
  }
  return merged;
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
    // Native traits come from today's enemy; reward benefits cannot become enemy actions.
    if (enemy && sanitizeEncounterTraitIds([trait.id], "combat").length === 0) return [];
    const canonical = traitMetadata.get(trait.id);
    return canonical ? [canonical] : [];
  });
  return [
    ...new Map(
      sanitizePersistedEnemyTraits([...(enemy?.traits ?? []), ...traits]).map((trait) => [trait.id, trait]),
    ).values(),
  ];
}

function normalizeEnemy(
  savedEnemy: BattleSnapshot["currentEnemy"] | undefined,
  defaultEnemy: BattleSnapshot["currentEnemy"],
): BattleSnapshot["currentEnemy"] {
  const catalogEnemy = savedEnemy && isEnemyId(savedEnemy.id) ? enemyById[savedEnemy.id] : undefined;
  const savedAbilityIds = savedEnemy?.abilityIds;
  const abilityIds =
    Array.isArray(savedAbilityIds) &&
    savedAbilityIds.length === 3 &&
    new Set(savedAbilityIds).size === 3 &&
    savedAbilityIds.every((id) => typeof id === "string" && findEnemyAbilityCard(id))
      ? savedAbilityIds
      : (catalogEnemy?.abilityIds ?? defaultEnemy.abilityIds);
  return {
    ...(catalogEnemy ?? defaultEnemy),
    abilityIds,
    traits: restoreEnemyTraits(savedEnemy?.traits, catalogEnemy),
  };
}

function normalizeCombatFlags(
  defaults: BattleSnapshot["flags"],
  saved: Partial<BattleSnapshot["flags"]> | undefined,
): BattleSnapshot["flags"] {
  const stored: Record<string, unknown> = saved ?? {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const value = Object.hasOwn(stored, key) ? stored[key] : undefined;
      if (typeof fallback === "boolean") return [key, typeof value === "boolean" ? value : fallback];
      return [key, typeof value === "number" ? clampNonNegative(value, fallback) : fallback];
    }),
  ) as BattleSnapshot["flags"];
}

function normalizeCombatResources(state: BattleSnapshot, defaults: BattleSnapshot) {
  const positiveOrDefault = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  const playerMaxHealth = positiveOrDefault(state.playerMaxHealth, defaults.playerMaxHealth);
  const enemyMaxHealth = positiveOrDefault(state.enemyMaxHealth, defaults.enemyMaxHealth);
  return {
    playerDodgeCount: clampNonNegative(state.playerDodgeCount, 0),
    dodgeChanceFromDamage: clampNonNegative(state.dodgeChanceFromDamage, 0),
    roomScalingMultiplier: positiveOrDefault(state.roomScalingMultiplier, defaults.roomScalingMultiplier),
    playerMaxHealth,
    enemyMaxHealth,
    playerHealth: Math.min(clampNonNegative(state.playerHealth, defaults.playerHealth), playerMaxHealth),
    enemyHealth: Math.min(clampNonNegative(state.enemyHealth, defaults.enemyHealth), enemyMaxHealth),
    gold: clampNonNegative(state.gold, defaults.gold),
    mana: clampNonNegative(state.mana, defaults.mana),
    maxMana: Math.max(MIN_MAX_MANA_FLOOR, clampNonNegative(state.maxMana, defaults.maxMana)),
  };
}

function normalizeCardPiles(state: BattleSnapshot, defaults: BattleSnapshot) {
  let highestCardUid = 0;
  for (const pile of [state.deck, state.hand, state.pendingHandCards, state.discard, state.exhausted]) {
    for (const card of pile) highestCardUid = Math.max(highestCardUid, toFiniteNonNegativeInt(card.uid) ?? 0);
  }
  const overflow = state.hand.slice(MAX_HAND_SIZE);
  return {
    cardsPlayedThisTurn: toFiniteNonNegativeInt(state.cardsPlayedThisTurn) ?? 0,
    nextCardUid: Math.max(toFiniteNonNegativeInt(state.nextCardUid) ?? defaults.nextCardUid, highestCardUid + 1),
    hand: overflow.length ? state.hand.slice(0, MAX_HAND_SIZE) : state.hand,
    pendingHandCards: overflow.length ? [...overflow, ...state.pendingHandCards] : state.pendingHandCards,
  };
}

function normalizeSurvival(state: BattleSnapshot, saved: Partial<BattleSnapshot>, defaults: BattleSnapshot) {
  const savedSurvival: { deathsDoorActive?: unknown; deathsDoorUsed?: unknown } = saved;
  // Load-path truncation (not battle Math.round): turn must stay an integer ≥1.
  const turn = Number.isFinite(state.turn) && state.turn >= 1 ? Math.trunc(state.turn) : defaults.turn;
  const triggeredTurn = toFiniteNonNegativeInt(state.deathsDoorTriggeredTurn);
  return {
    turn,
    deathsDoorActive: savedSurvival.deathsDoorActive === true,
    deathsDoorUsed: savedSurvival.deathsDoorUsed === true,
    deathsDoorGraceTurnsRemaining: toFiniteNonNegativeInt(state.deathsDoorGraceTurnsRemaining),
    deathsDoorTriggeredTurn:
      triggeredTurn !== null && triggeredTurn >= 1 && triggeredTurn <= turn ? triggeredTurn : null,
  };
}

export function normalizePersistedBattleState(saved: Partial<BattleSnapshot>): BattleSnapshot {
  // Current Forge has no threshold reactions; discard the obsolete queue at load.
  const { pendingForgeThresholds: _retiredForgeQueue, ...current } = saved as Partial<BattleSnapshot> & {
    pendingForgeThresholds?: unknown;
  };
  saved = current;
  const defaults = defaultBattleState();
  const currentEnemy = normalizeEnemy(saved.currentEnemy, defaults.currentEnemy);
  const merged: BattleSnapshot = {
    ...battleSnapshot({ ...defaults, ...saved }),
    encounterBenefits:
      saved.contentSystemType === "labyrinth" && Array.isArray(saved.encounterBenefits)
        ? sanitizeEncounterTraitIds(saved.encounterBenefits, "reward")
        : [],
    trinketEffects: { ...defaults.trinketEffects, ...saved.trinketEffects },
    gearEffects: normalizeGearEffects(saved.gearEffects),
    talentEffects: normalizeTalentEffects(defaults.talentEffects, saved.talentEffects),
    flags: normalizeCombatFlags(defaults.flags, saved.flags),
    uniqueGear: Object.fromEntries(
      Object.entries(defaults.uniqueGear).map(([key, value]) => [
        key,
        saved.uniqueGear?.[key as keyof typeof defaults.uniqueGear] ?? value,
      ]),
    ) as typeof defaults.uniqueGear,
    playerStatuses: normalizeNonNegativeRecord(defaults.playerStatuses, saved.playerStatuses),
    enemyStatuses: normalizeNonNegativeRecord(defaults.enemyStatuses, saved.enemyStatuses),
    playerCC: normalizeNonNegativeRecord(defaults.playerCC, saved.playerCC),
    enemyCC: normalizeNonNegativeRecord(defaults.enemyCC, saved.enemyCC),
    enemyMitigation: normalizeNonNegativeRecord(defaults.enemyMitigation, saved.enemyMitigation),
    pendingTurnStartEffects: saved.pendingTurnStartEffects ?? defaults.pendingTurnStartEffects,
    pendingHandCards: saved.pendingHandCards ?? defaults.pendingHandCards,
    currentEnemy,
    lastEnemyAbilityId:
      typeof saved.lastEnemyAbilityId === "string" && currentEnemy.abilityIds.includes(saved.lastEnemyAbilityId)
        ? saved.lastEnemyAbilityId
        : null,
  };
  // battleMetrics is runtime-only telemetry; never persisted.
  delete merged.battleMetrics;
  const companion = merged.activeCompanion;
  return {
    ...merged,
    ...normalizeCombatResources(merged, defaults),
    ...normalizeCardPiles(merged, defaults),
    ...normalizeSurvival(merged, saved, defaults),
    pendingCardBleedLeechHealing: Math.min(
      clampNonNegative(merged.pendingBleedLeechHealing, 0),
      clampNonNegative(merged.pendingCardBleedLeechHealing, 0),
    ),
    activeCompanion:
      companion && typeof companion.id === "string" && Object.hasOwn(companionLibrary, companion.id)
        ? companionLibrary[companion.id]
        : null,
  };
}
