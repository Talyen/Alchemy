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
import { computeTrinketManifest, isDefaultTrinketManifest } from "@/lib/trinkets";
import { MAX_HAND_SIZE, MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { toFiniteNonNegativeInt } from "./save-schemas/validation-utils";
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
  const knownSaved = Object.fromEntries(
    Object.entries(saved ?? {}).filter(([key]) => Object.hasOwn(defaults, key)),
  ) as Partial<TalentEffectManifest>;
  const merged = mergeRecord(defaults, knownSaved);
  if (!Array.isArray(merged.healthThresholdArmor)) merged.healthThresholdArmor = [];
  const savedRecord = saved ?? {};
  merged.wishExtraChoiceAfterHolyCard = savedRecord.wishExtraChoiceAfterHolyCard === true;
  merged.leechCardDamageVsLowHealthPercent = clampNonNegative(merged.leechCardDamageVsLowHealthPercent, 0);
  return merged;
}

function clampNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeNonNegativeRecord<T extends { [K in keyof T]: number }>(
  defaults: T,
  saved: Partial<T> | undefined,
): T {
  const merged = mergeRecord(defaults, saved);
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const value = merged[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) merged[key] = defaults[key];
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
  const flags = mergeRecord(defaults, saved);
  const savedFlags: Record<string, unknown> = saved ?? {};
  // Only these transient signals require an exact boolean; every other saved
  // flag keeps its persisted value via the manifest merge above.
  for (const key of [
    "hawkEyeReady",
    "pendingCinderSkinReaction",
    "nextWishExtraChoice",
    "previousCardWasArchery",
    "previousCardWasNature",
    "firstBurnCardFreeUsed",
    "archerySecondCardActive",
  ] as const) {
    flags[key] = savedFlags[key] === true;
  }
  for (const key of [
    "companionNextAttackBonus",
    "sanguinePhysicalBonus",
    "darkRecoveryMana",
    "pendingWishMana",
    "archeryCardsPlayedThisTurn",
  ] as const) {
    flags[key] = clampNonNegative(flags[key], 0);
  }
  return flags;
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
  const highestCardUid = [state.deck, state.hand, state.pendingHandCards, state.discard, state.exhausted].reduce(
    (highest, cards) => cards.reduce((max, card) => Math.max(max, toFiniteNonNegativeInt(card.uid) ?? 0), highest),
    0,
  );
  return {
    cardsPlayedThisTurn: toFiniteNonNegativeInt(state.cardsPlayedThisTurn) ?? 0,
    nextCardUid: Math.max(toFiniteNonNegativeInt(state.nextCardUid) ?? defaults.nextCardUid, highestCardUid + 1),
    hand: state.hand.length > MAX_HAND_SIZE ? state.hand.slice(0, MAX_HAND_SIZE) : state.hand,
    pendingHandCards:
      state.hand.length > MAX_HAND_SIZE
        ? [...state.hand.slice(MAX_HAND_SIZE), ...state.pendingHandCards]
        : state.pendingHandCards,
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
  const defaults = defaultBattleState();
  const currentEnemy = normalizeEnemy(saved.currentEnemy, defaults.currentEnemy);
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
    flags: normalizeCombatFlags(defaults.flags, saved.flags),
    uniqueGear: mergeRecord(defaults.uniqueGear, saved.uniqueGear),
    playerStatuses: normalizeNonNegativeRecord(defaults.playerStatuses, saved.playerStatuses),
    enemyStatuses: normalizeNonNegativeRecord(defaults.enemyStatuses, saved.enemyStatuses),
    playerCC: normalizeNonNegativeRecord(defaults.playerCC, saved.playerCC),
    enemyCC: normalizeNonNegativeRecord(defaults.enemyCC, saved.enemyCC),
    enemyMitigation: normalizeNonNegativeRecord(defaults.enemyMitigation, saved.enemyMitigation),
    pendingTurnStartEffects: saved.pendingTurnStartEffects ?? defaults.pendingTurnStartEffects,
    pendingHandCards: saved.pendingHandCards ?? defaults.pendingHandCards,
    pendingForgeThresholds: saved.pendingForgeThresholds ?? defaults.pendingForgeThresholds,
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

export function repairPersistedTrinketManifest(battleState: BattleSnapshot, runBoons: string[]): BattleSnapshot {
  if (runBoons.length === 0) return battleState;
  if (!isDefaultTrinketManifest(battleState.trinketEffects)) return battleState;
  return {
    ...battleState,
    trinketEffects: computeTrinketManifest(runBoons),
  };
}
