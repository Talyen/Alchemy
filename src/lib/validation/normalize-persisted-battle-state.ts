import {
  createEmptyGearEffectManifest,
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
  cardById,
  findEnemyAbilityCard,
  enemyById,
  enemyBestiary,
  companionLibrary,
  isEnemyId,
  isMixedPotionCard,
  type BattleCard,
  type BestiaryEntry,
  type EnemyTrait,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { MAX_HAND_SIZE, MIN_MAX_MANA_FLOOR } from "@/lib/game-constants";
import { toFiniteNonNegativeInt, toSafeNonNegativeInt } from "./save-schemas/validation-utils";
import { isRecord } from "@/lib/utils";
import {
  ENCOUNTER_TRAITS,
  sanitizeEncounterTraitIds,
  sanitizePersistedEnemyTraits,
} from "@/lib/content-systems/encounter-traits";

// Deliberate removals are recorded in TOMBSTONED_CARD_IDS for explicit
// fixtures; load drops every non-live id identically via this single check.
export function isRecoverableCard(card: Pick<BattleCard, "id" | "cost" | "effects" | "descriptionLines">): boolean {
  if (Object.hasOwn(cardById, card.id)) return true;
  return (
    isMixedPotionCard(card) &&
    Number.isInteger(card.cost) &&
    card.cost >= 0 &&
    card.effects.length > 0 &&
    card.descriptionLines.length > 0
  );
}

export function filterLiveCards<T extends Pick<BattleCard, "id" | "cost" | "effects" | "descriptionLines">>(
  cards: readonly T[],
): T[] {
  return cards.filter(isRecoverableCard);
}

function normalizeReactions(saved: unknown): BattleSnapshot["reactions"] {
  const reactions = createElementalReactionState();
  if (!isRecord(saved)) return reactions;
  const record = saved;
  for (const key of Object.keys(reactions) as Array<keyof typeof reactions>) {
    const value = Object.hasOwn(record, key) ? record[key] : undefined;
    if (key === "consecrated") {
      reactions.consecrated = value === true;
      continue;
    }
    const amount = typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
    if (key === "wildfirePendingTickDamage" || key === "wildfireLastTickTurn")
      reactions[key] = amount !== null && amount > 0 ? amount : null;
    else reactions[key] = amount ?? 0;
  }
  return reactions;
}

function normalizeGearEffects(saved: Partial<GearEffectManifest> | undefined): GearEffectManifest {
  const result = createEmptyGearEffectManifest();
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

const isMagnitude = (value: number) => value >= 0 && value < Number.MAX_SAFE_INTEGER;
const isCounter = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Defaults select known fields and their kinds; each manifest keeps its numeric repair rule. */
function normalizeManifest<T extends object>(
  defaults: T,
  saved: unknown,
  validNumber: (value: number) => boolean,
  ownOnly = false,
): T {
  const fields = saved as Partial<T> | undefined;
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const value = ownOnly && !Object.hasOwn(fields ?? {}, key) ? undefined : fields?.[key as keyof T];
      const valid = Array.isArray(fallback)
        ? Array.isArray(value)
        : typeof fallback === "boolean"
          ? typeof value === "boolean"
          : typeof value === "number" && validNumber(value);
      return [key, valid ? value : fallback];
    }),
  ) as T;
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

function normalizeNonNegativeRecord<K extends string>(defaults: Record<K, number>, input: unknown): Record<K, number> {
  return normalizeManifest(defaults, isRecord(input) ? input : {}, isMagnitude);
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
  const traits: EnemyTrait[] = [];
  value.forEach((trait: unknown) => {
    if (!trait || typeof trait !== "object" || !("id" in trait) || typeof trait.id !== "string") return;
    // Native traits come from today's enemy; reward benefits cannot become enemy actions.
    if (enemy && sanitizeEncounterTraitIds([trait.id], "combat").length === 0) return;
    const canonical = traitMetadata.get(trait.id);
    if (canonical) traits.push(canonical);
  });
  return [
    ...new Map(
      sanitizePersistedEnemyTraits([...(enemy?.traits ?? []), ...traits]).map((trait) => [trait.id, trait]),
    ).values(),
  ];
}

function isSavedAbilityRoster(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value[0] !== value[1] &&
    value[0] !== value[2] &&
    value[1] !== value[2] &&
    value.every((id: unknown) => typeof id === "string" && Boolean(findEnemyAbilityCard(id)))
  );
}

function normalizeEnemy(input: unknown, defaultEnemy: BattleSnapshot["currentEnemy"]): BattleSnapshot["currentEnemy"] {
  const savedEnemy = isRecord(input) ? input : undefined;
  const catalogEnemy =
    savedEnemy && typeof savedEnemy.id === "string" && isEnemyId(savedEnemy.id) ? enemyById[savedEnemy.id] : undefined;
  const savedAbilityIds = savedEnemy?.abilityIds;
  const abilityIds = isSavedAbilityRoster(savedAbilityIds)
    ? savedAbilityIds
    : (catalogEnemy?.abilityIds ?? defaultEnemy.abilityIds);
  return {
    ...(catalogEnemy ?? defaultEnemy),
    abilityIds,
    traits: restoreEnemyTraits(savedEnemy?.traits, catalogEnemy),
  };
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
    // Negative saved Health is corruption, repaired to combatant maximums.
    // Zero Health is preserved for terminal battle resumption (victory / defeat settlement).
    playerHealth:
      state.playerHealth >= 0
        ? Math.min(clampNonNegative(state.playerHealth, defaults.playerHealth), playerMaxHealth)
        : playerMaxHealth,
    enemyHealth:
      state.enemyHealth >= 0
        ? Math.min(clampNonNegative(state.enemyHealth, defaults.enemyHealth), enemyMaxHealth)
        : enemyMaxHealth,
    enemyRegeneration: clampNonNegative(state.enemyRegeneration, defaults.enemyRegeneration),
    enemyPhysicalDamageBonus: clampNonNegative(state.enemyPhysicalDamageBonus, defaults.enemyPhysicalDamageBonus),
    // Match SaveDataSchema's live-combat gold rule (Math.round, not floor):
    // a fractional purse must repair to the same integer in both paths.
    gold: toSafeNonNegativeInt(Math.round(state.gold)) ?? defaults.gold,
    mana: clampNonNegative(state.mana, defaults.mana),
    maxMana: Math.max(MIN_MAX_MANA_FLOOR, clampNonNegative(state.maxMana, defaults.maxMana)),
  };
}

function normalizeCardPiles(state: BattleSnapshot, defaults: BattleSnapshot) {
  const piles = ["hand", "pendingHandCards", "deck", "discard", "exhausted"] as const;
  const live = {
    hand: filterLiveCards(state.hand),
    pendingHandCards: filterLiveCards(state.pendingHandCards),
    deck: filterLiveCards(state.deck),
    discard: filterLiveCards(state.discard),
    exhausted: filterLiveCards(state.exhausted),
  };
  // Leave room for every repair and the next draw; oversized saved counters
  // otherwise stop advancing under floating-point arithmetic.
  const maxRetainedUid = Number.MAX_SAFE_INTEGER - piles.reduce((total, pile) => total + live[pile].length, 0) - 2;
  const isUsableUid = (uid: number | undefined): uid is number =>
    typeof uid === "number" && Number.isSafeInteger(uid) && uid >= 0 && uid <= maxRetainedUid;
  const counts = new Map<number, number>();
  let highestCardUid = 0;
  for (const pile of piles) {
    for (const card of live[pile]) {
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
  const repaired = { ...live };
  for (const pile of piles) {
    repaired[pile] = live[pile].map((card) => {
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
  const wishOptions = state.wishOptions ? filterLiveCards(state.wishOptions) : null;
  const wishQueue: BattleCard[][] = [];
  for (const choices of state.wishQueue) {
    const options = filterLiveCards(choices);
    if (options.length > 0) wishQueue.push(options);
  }
  if (wishOptions?.length) return { wishOptions, wishQueue };
  const [nextWishOptions = null, ...remainingQueue] = wishQueue;
  return { wishOptions: nextWishOptions, wishQueue: remainingQueue };
}

function normalizeSurvival(state: BattleSnapshot, saved: DecodedPersistedBattle, defaults: BattleSnapshot) {
  const savedSurvival: { deathsDoorActive?: unknown; deathsDoorUsed?: unknown } = saved;
  // Load-path truncation (not battle Math.round): turn must stay an integer ≥1.
  const turn =
    Number.isFinite(state.turn) && state.turn >= 1 && state.turn < Number.MAX_SAFE_INTEGER
      ? Math.trunc(state.turn)
      : defaults.turn;
  const triggeredTurn = toSafeNonNegativeInt(state.deathsDoorTriggeredTurn);
  return {
    turn,
    deathsDoorActive: savedSurvival.deathsDoorActive === true,
    deathsDoorUsed: savedSurvival.deathsDoorActive === true || savedSurvival.deathsDoorUsed === true,
    deathsDoorGraceTurnsRemaining: toSafeNonNegativeInt(state.deathsDoorGraceTurnsRemaining),
    deathsDoorTriggeredTurn:
      triggeredTurn !== null && triggeredTurn >= 1 && triggeredTurn <= turn ? triggeredTurn : null,
  };
}

/** Structurally decoded fields still contain untrusted manifest/identity records. */
export type DecodedPersistedBattle = Omit<
  Partial<BattleSnapshot>,
  "currentEnemy" | "playerStatuses" | "enemyStatuses" | "flags" | "reactions"
> & {
  currentEnemy?: unknown;
  playerStatuses?: unknown;
  enemyStatuses?: unknown;
  flags?: unknown;
  reactions?: unknown;
};

export function normalizePersistedBattleState(saved: DecodedPersistedBattle): BattleSnapshot {
  // Defaults own the persisted shape; retired fields and runtime dependencies
  // must not survive merely because the wire schema tolerates unknown keys.
  const defaults = battleSnapshot(defaultBattleState());
  saved = Object.fromEntries(
    Object.keys(defaults)
      .filter((key) => Object.hasOwn(saved, key))
      .map((key) => [key, saved[key as keyof BattleSnapshot]]),
  );
  const currentEnemy = normalizeEnemy(saved.currentEnemy, defaults.currentEnemy);
  const merged: BattleSnapshot = {
    ...defaults,
    ...saved,
    encounterBenefits:
      saved.contentSystemType === "labyrinth" && Array.isArray(saved.encounterBenefits)
        ? sanitizeEncounterTraitIds(saved.encounterBenefits, "reward")
        : [],
    trinketEffects: normalizeManifest(defaults.trinketEffects, saved.trinketEffects, isMagnitude),
    gearEffects: normalizeGearEffects(saved.gearEffects),
    talentEffects: normalizeTalentEffects(defaults.talentEffects, saved.talentEffects),
    flags: normalizeManifest(
      defaults.flags,
      isRecord(saved.flags) ? saved.flags : {},
      (value) => isCounter(value) && isMagnitude(value),
      true,
    ),
    reactions: normalizeReactions(saved.reactions),
    uniqueGear: normalizeManifest(defaults.uniqueGear, saved.uniqueGear, isCounter),
    playerStatuses: normalizeNonNegativeRecord(defaults.playerStatuses, saved.playerStatuses),
    enemyStatuses: normalizeNonNegativeRecord(defaults.enemyStatuses, saved.enemyStatuses),
    playerCC: normalizeManifest(defaults.playerCC, saved.playerCC, isCounter),
    enemyCC: normalizeManifest(defaults.enemyCC, saved.enemyCC, isCounter),
    enemyMitigation: normalizeNonNegativeRecord(defaults.enemyMitigation, saved.enemyMitigation),
    pendingTurnStartEffects: Array.isArray(saved.pendingTurnStartEffects)
      ? saved.pendingTurnStartEffects.filter(
          (pulse): pulse is BattleSnapshot["pendingTurnStartEffects"][number] =>
            isRecord(pulse) &&
            typeof pulse.remainingTurns === "number" &&
            Number.isSafeInteger(pulse.remainingTurns) &&
            pulse.remainingTurns >= 1 &&
            Array.isArray(pulse.effects),
        )
      : defaults.pendingTurnStartEffects,
    pendingHandCards: saved.pendingHandCards ?? defaults.pendingHandCards,
    currentEnemy,
    lastEnemyAbilityId:
      typeof saved.lastEnemyAbilityId === "string" && currentEnemy.abilityIds.includes(saved.lastEnemyAbilityId)
        ? saved.lastEnemyAbilityId
        : null,
  };
  merged.reactions = expireCcReactions(merged).reactions;
  if (merged.enemyStatuses.bleed <= 0) merged.reactions.consecrated = false;
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
