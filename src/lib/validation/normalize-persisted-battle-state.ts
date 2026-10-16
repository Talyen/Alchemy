import {
  defaultGearEffects,
  GEAR_NUMERIC_EFFECT_KEYS,
  GEAR_CHANCE_EFFECT_KEYS,
  type GearEffectManifest,
} from "@/lib/gear";
import {
  battleSnapshot,
  defaultBattleState,
  expireCcReactions,
  createElementalReactionState,
  type BattleSnapshot,
} from "@/lib/battle";
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
import { toFiniteNonNegativeInt, toSafeNonNegativeInt } from "./save-schemas/validation-utils";
import {
  ENCOUNTER_TRAITS,
  sanitizeEncounterTraitIds,
  sanitizePersistedEnemyTraits,
} from "@/lib/content-systems/encounter-traits";

function normalizeReactions(saved: unknown): BattleSnapshot["reactions"] {
  const reactions = createElementalReactionState();
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return reactions;
  const record = saved as Record<string, unknown>;
  for (const key of Object.keys(reactions) as Array<keyof typeof reactions>) {
    const value = Object.hasOwn(record, key) ? record[key] : undefined;
    const amount = typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
    if (key === "wildfirePendingTickDamage" || key === "wildfireLastTickTurn")
      reactions[key] = amount !== null && amount > 0 ? amount : null;
    else reactions[key] = amount ?? 0;
  }
  return reactions;
}

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

function normalizeTrinketEffects(
  defaults: BattleSnapshot["trinketEffects"],
  saved: Partial<BattleSnapshot["trinketEffects"]> | undefined,
): BattleSnapshot["trinketEffects"] {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const value = saved?.[key as keyof typeof defaults];
      return [
        key,
        typeof fallback === "boolean"
          ? typeof value === "boolean"
            ? value
            : fallback
          : typeof value === "number"
            ? clampNonNegative(value, fallback)
            : fallback,
      ];
    }),
  ) as BattleSnapshot["trinketEffects"];
}

function normalizeMagnitudeDictionary(saved: unknown): Record<string, number> {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  return Object.fromEntries(
    Object.entries(saved).filter(
      ([, value]) => typeof value === "number" && value >= 0 && value < Number.MAX_SAFE_INTEGER,
    ),
  );
}

function isHealthThresholdReward(value: unknown): value is { threshold: number; amount: number } {
  if (!value || typeof value !== "object") return false;
  const reward = value as Record<string, unknown>;
  return (
    typeof reward.threshold === "number" &&
    reward.threshold > 0 &&
    reward.threshold <= 100 &&
    typeof reward.amount === "number" &&
    reward.amount > 0 &&
    reward.amount < Number.MAX_SAFE_INTEGER
  );
}

function normalizeTalentEffects(
  defaults: TalentEffectManifest,
  saved: Partial<TalentEffectManifest> | undefined,
): TalentEffectManifest {
  const knownSaved = Object.fromEntries(
    Object.entries(saved ?? {}).filter(([key, value]) => {
      if (!Object.hasOwn(defaults, key)) return false;
      const fallback = defaults[key as keyof TalentEffectManifest];
      if (typeof fallback === "number")
        return typeof value === "number" && value >= 0 && value < Number.MAX_SAFE_INTEGER;
      if (typeof fallback === "boolean") return typeof value === "boolean";
      return true;
    }),
  ) as Partial<TalentEffectManifest>;
  const merged = { ...defaults, ...knownSaved };
  merged.cardHealMultipliers = normalizeMagnitudeDictionary(merged.cardHealMultipliers);
  merged.companionBondLevels = normalizeNonNegativeRecord(defaults.companionBondLevels, merged.companionBondLevels);
  merged.healthThresholdArmor = Array.isArray(merged.healthThresholdArmor)
    ? merged.healthThresholdArmor.filter(isHealthThresholdReward)
    : [];
  merged.healthThresholdBlockOnce = isHealthThresholdReward(merged.healthThresholdBlockOnce)
    ? merged.healthThresholdBlockOnce
    : null;
  merged.leechCardDamageVsLowHealthPercent = clampNonNegative(merged.leechCardDamageVsLowHealthPercent, 0);
  return merged;
}

// Finite values above the safe range can swallow ordinary gains, hits, or decrements.
function clampNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER ? value : fallback;
}

function normalizeNonNegativeRecord<K extends string>(
  defaults: Record<K, number>,
  saved: Partial<Record<K, number>> | undefined,
): Record<K, number> {
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as K[]) {
    const value = saved?.[key];
    if (typeof value === "number" && value >= 0 && value < Number.MAX_SAFE_INTEGER) merged[key] = value;
  }
  return merged;
}

function normalizeCcState(
  defaults: BattleSnapshot["playerCC"],
  saved: Partial<BattleSnapshot["playerCC"]> | undefined,
) {
  const merged = normalizeNonNegativeRecord(defaults, saved);
  for (const key of ["stunSkipTurns", "freezeSkipTurns", "cooldown"] as const) {
    if (!Number.isSafeInteger(merged[key])) merged[key] = defaults[key];
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
      return [
        key,
        typeof value === "number" && Number.isSafeInteger(value) ? clampNonNegative(value, fallback) : fallback,
      ];
    }),
  ) as BattleSnapshot["flags"];
}

function normalizeCombatResources(state: BattleSnapshot, defaults: BattleSnapshot) {
  const positiveOrDefault = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 && value < Number.MAX_SAFE_INTEGER ? value : fallback;
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
    enemyRegeneration: clampNonNegative(state.enemyRegeneration, defaults.enemyRegeneration),
    enemyPhysicalDamageBonus: clampNonNegative(state.enemyPhysicalDamageBonus, defaults.enemyPhysicalDamageBonus),
    companionDamageBuff: clampNonNegative(state.companionDamageBuff, defaults.companionDamageBuff),
    gold: toSafeNonNegativeInt(state.gold) ?? defaults.gold,
    mana: clampNonNegative(state.mana, defaults.mana),
    maxMana: Math.max(MIN_MAX_MANA_FLOOR, clampNonNegative(state.maxMana, defaults.maxMana)),
  };
}

function normalizeCardPiles(state: BattleSnapshot, defaults: BattleSnapshot) {
  const piles = ["hand", "pendingHandCards", "deck", "discard", "exhausted"] as const;
  // Leave room for every repair and the next draw; oversized saved counters
  // otherwise stop advancing under floating-point arithmetic.
  const maxRetainedUid = Number.MAX_SAFE_INTEGER - piles.reduce((total, pile) => total + state[pile].length, 0) - 2;
  const isUsableUid = (uid: number | undefined): uid is number =>
    Number.isSafeInteger(uid) && uid! >= 0 && uid! <= maxRetainedUid;
  const counts = new Map<number, number>();
  let highestCardUid = 0;
  for (const pile of piles) {
    for (const card of state[pile]) {
      if (isUsableUid(card.uid)) {
        counts.set(card.uid, (counts.get(card.uid) ?? 0) + 1);
        highestCardUid = Math.max(highestCardUid, card.uid);
      }
    }
  }
  let nextCardUid = Math.max(
    isUsableUid(state.nextCardUid) ? state.nextCardUid : defaults.nextCardUid,
    highestCardUid + 1,
  );
  const used = new Set<number>();
  const repaired = { ...state };
  for (const pile of piles) {
    repaired[pile] = state[pile].map((card) => {
      if (isUsableUid(card.uid) && !used.has(card.uid)) {
        used.add(card.uid);
        return card;
      }
      // Undrawn cards may have no presentation identity yet; visible cards must.
      if (card.uid === undefined && pile !== "hand" && pile !== "pendingHandCards") return card;
      return { ...card, uid: nextCardUid++ };
    });
  }
  const unambiguousUid = (uid: number | null) => (uid !== null && counts.get(uid) === 1 ? uid : null);
  const overflow = repaired.hand.slice(MAX_HAND_SIZE);
  return {
    deck: repaired.deck,
    discard: repaired.discard,
    exhausted: repaired.exhausted,
    uniqueGear: {
      ...state.uniqueGear,
      lastArcheryUid: unambiguousUid(state.uniqueGear.lastArcheryUid),
      returningFlightUids: [...new Set(state.uniqueGear.returningFlightUids)].filter(
        (uid) => unambiguousUid(uid) !== null,
      ),
    },
    cardsPlayedThisTurn: toFiniteNonNegativeInt(state.cardsPlayedThisTurn) ?? 0,
    nextCardUid,
    hand: overflow.length ? repaired.hand.slice(0, MAX_HAND_SIZE) : repaired.hand,
    pendingHandCards: [...overflow, ...repaired.pendingHandCards],
  };
}

function normalizeWishChoices(state: BattleSnapshot) {
  const queue = state.wishQueue.filter((options) => options.length > 0);
  if (state.wishOptions?.length) return { wishOptions: state.wishOptions, wishQueue: queue };
  const [wishOptions = null, ...wishQueue] = queue;
  return { wishOptions, wishQueue };
}

function normalizeSurvival(state: BattleSnapshot, saved: Partial<BattleSnapshot>, defaults: BattleSnapshot) {
  const savedSurvival: { deathsDoorActive?: unknown; deathsDoorUsed?: unknown } = saved;
  // Load-path truncation (not battle Math.round): turn must stay an integer ≥1.
  const turn =
    Number.isFinite(state.turn) && state.turn >= 1 && state.turn < Number.MAX_SAFE_INTEGER
      ? Math.trunc(state.turn)
      : defaults.turn;
  const safeCounter = (value: unknown) => {
    const counter = toFiniteNonNegativeInt(value);
    return counter !== null && Number.isSafeInteger(counter) ? counter : null;
  };
  const triggeredTurn = safeCounter(state.deathsDoorTriggeredTurn);
  return {
    turn,
    deathsDoorActive: savedSurvival.deathsDoorActive === true,
    deathsDoorUsed: savedSurvival.deathsDoorActive === true || savedSurvival.deathsDoorUsed === true,
    deathsDoorGraceTurnsRemaining: safeCounter(state.deathsDoorGraceTurnsRemaining),
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
    trinketEffects: normalizeTrinketEffects(defaults.trinketEffects, saved.trinketEffects),
    gearEffects: normalizeGearEffects(saved.gearEffects),
    talentEffects: normalizeTalentEffects(defaults.talentEffects, saved.talentEffects),
    flags: normalizeCombatFlags(defaults.flags, saved.flags),
    reactions: normalizeReactions(saved.reactions),
    uniqueGear: Object.fromEntries(
      Object.entries(defaults.uniqueGear).map(([key, value]) => [
        key,
        saved.uniqueGear?.[key as keyof typeof defaults.uniqueGear] ?? value,
      ]),
    ) as typeof defaults.uniqueGear,
    playerStatuses: normalizeNonNegativeRecord(defaults.playerStatuses, saved.playerStatuses),
    enemyStatuses: normalizeNonNegativeRecord(defaults.enemyStatuses, saved.enemyStatuses),
    playerCC: normalizeCcState(defaults.playerCC, saved.playerCC),
    enemyCC: normalizeCcState(defaults.enemyCC, saved.enemyCC),
    enemyMitigation: normalizeNonNegativeRecord(defaults.enemyMitigation, saved.enemyMitigation),
    pendingTurnStartEffects: saved.pendingTurnStartEffects ?? defaults.pendingTurnStartEffects,
    pendingHandCards: saved.pendingHandCards ?? defaults.pendingHandCards,
    currentEnemy,
    lastEnemyAbilityId:
      typeof saved.lastEnemyAbilityId === "string" && currentEnemy.abilityIds.includes(saved.lastEnemyAbilityId)
        ? saved.lastEnemyAbilityId
        : null,
  };
  merged.reactions = expireCcReactions(merged).reactions;
  // battleMetrics is runtime-only telemetry; never persisted.
  delete merged.battleMetrics;
  // Glacial Surge is now a native flat bonus; saved growth must not stack with it.
  if (currentEnemy.traits.some((trait) => trait.id === "glacial-shell")) merged.enemyStatuses.freezeBonus = 0;
  const companion = merged.activeCompanion;
  const resources = normalizeCombatResources(merged, defaults);
  const survival = normalizeSurvival(merged, saved, defaults);
  const pendingBleedLeechHealing = Math.min(
    clampNonNegative(merged.pendingBleedLeechHealing, 0),
    merged.enemyStatuses.bleed,
  );
  return {
    ...merged,
    ...resources,
    ...normalizeWishChoices(merged),
    ...normalizeCardPiles(merged, defaults),
    ...survival,
    playerHealth: survival.deathsDoorActive ? Math.max(1, resources.playerHealth) : resources.playerHealth,
    pendingBleedLeechHealing,
    pendingEnemyBleedLeechHealing: Math.min(
      clampNonNegative(merged.pendingEnemyBleedLeechHealing, 0),
      merged.playerStatuses.bleed,
    ),
    pendingCardBleedLeechHealing: Math.min(
      pendingBleedLeechHealing,
      clampNonNegative(merged.pendingCardBleedLeechHealing, 0),
    ),
    activeCompanion:
      companion && typeof companion.id === "string" && Object.hasOwn(companionLibrary, companion.id)
        ? companionLibrary[companion.id]
        : null,
  };
}
