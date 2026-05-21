/**
 * Initializes battle states, scales enemy stats, and handles deck drawing and card shuffling.
 * Depends on: @/lib/game-data, ../utils, ../game-constants, ./types, ../trinkets.
 * Depended on by: ./card-play, ./enemy-turn, ./status-effects, ./wish, ./types.
 */
import { companionLibrary, createEmptyTalentManifest, type CompanionDefinition } from "@/lib/game-data";
import type { BattleCard, BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data/types";
import type { DifficultyModifier } from "@/lib/game-data/difficulties";

import { shuffle } from "../utils";
import {
  BASE_ENEMY_HEALTH,
  BASE_PLAYER_MANA,
  CARDS_PER_TURN,
  FALLBACK_ENEMY_ATTACK,
  LIVING_ARMOR_STARTING_ARMOR,
  MAX_HAND_SIZE,
  MAX_PLAYER_HEALTH,
  ROOM_SCALING_INCREMENT,
  ELITE_HP_MULTIPLIER,
  BOSS_HEALTH_MULTIPLIER,
  ENEMY_BASE_REGENERATION,
  ENEMY_BOSS_REGENERATION,
  LABYRINTH_STURDY_MULTIPLIER,
} from "../game-constants";
import {
  type BattleState,
  type EnemyStatusValues,
  type PlayerStatusValues,
  type TalentEffectManifest,
  type CombatFlags,
  type TurnPhase,
} from "./types";
import { computeTrinketManifest, defaultTrinketEffects } from "../trinkets";

// Default talent manifest used when no talents are unlocked. Every field must have a safe
// zero/false value so battle logic can read talentEffects without existence checks.
// Defined via the shared factory so new manifest fields are caught at compile time.
export const defaultTalentEffects: TalentEffectManifest = createEmptyTalentManifest();

const skeletonEnemy = {
  id: "skeleton",
  title: "Skeleton",
  subtitle: "",
  descriptionLines: [""],
  art: "",
  enemyType: "normal" as const,
  traits: [],
  attackEffects: [],
};

function createEmptyPlayerStatuses(): PlayerStatusValues {
  return {
    block: 0,
    armor: 0,
    forge: 0,
    haste: 0,
    burn: 0,
    poison: 0,
    bleed: 0,
    freeze: 0,
    stun: 0,
  } satisfies PlayerStatusValues;
}

function createEmptyEnemyStatuses(): EnemyStatusValues {
  return { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 } satisfies EnemyStatusValues;
}

function createInitialFlags(): CombatFlags {
  return {
    firstPhysicalCardFreeUsed: false,
    firstHolyCardFreeUsed: false,
    firstBurnCardDoubledUsed: false,
    firstArmorCardDoubledUsed: false,
    firstPoisonCardFreeUsed: false,
    firstBleedCardFreeUsed: false,
    nextCardCostReduction: 0,
    goldOnFirstPoisonThisCombat: false,
    firstHolyDamageBonusUsed: false,
    firstBurnTrinketDoubledUsed: false,
    firstHarmfulStatusPrevented: false,
    firstPotionFreeUsed: false,
    resonantChimeUsedThisTurn: false,
  };
}

/**
 * Instantiates the default initial state for an inactive/placeholder battle setup.
 */
export function defaultBattleState(): BattleState {
  return {
    deck: [],
    hand: [],
    discard: [],
    exhausted: [],
    mana: 0,
    maxMana: 0,
    gold: 0,
    turn: 1,
    turnPhase: "player",
    playerHealth: MAX_PLAYER_HEALTH,
    playerMaxHealth: MAX_PLAYER_HEALTH,
    deathsDoorUsed: false,
    deathsDoorActive: false,
    deathsDoorTriggeredTurn: null,
    enemyHealth: BASE_ENEMY_HEALTH,
    enemyMaxHealth: BASE_ENEMY_HEALTH,
    enemyAttackEffects: [],
    enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 },
    enemyRegeneration: 0,
    playerStatuses: createEmptyPlayerStatuses(),
    enemyStatuses: createEmptyEnemyStatuses(),
    pendingBleedLeechHealing: 0,
    enemyStunSkipTurns: 0,
    enemyFreezeSkipTurns: 0,
    playerStunSkipTurns: 0,
    playerFreezeSkipTurns: 0,
    playerCCCooldown: 0,
    enemyCCCooldown: 0,
    wishOptions: null,
    wishQueue: [],
    activeCompanion: null,
    companionDamageBuff: 0,
    currentEnemy: skeletonEnemy,
    talentEffects: defaultTalentEffects,
    trinketEffects: { ...defaultTrinketEffects },
    flags: createInitialFlags(),
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
    difficultyModifiers: [],
  };
}

/**
 * Returns a fresh (deck, discard) pair after possibly reshuffling discard into deck.
 */
function refillDeck(deck: BattleCard[], discard: BattleCard[]) {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffleCards(discard), discard: [] };
}

/**
 * Draws cards from the deck into the hand. If the deck runs out, the discard pile
 * is shuffled back into the deck. Stops at maxHandSize.
 */
export function drawCards(
  deck: BattleCard[],
  discard: BattleCard[],
  hand: BattleCard[],
  amount: number,
  nextCardUid = 0,
) {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const nextHand = [...hand];
  let uid = nextCardUid;

  for (let i = 0; i < amount && nextHand.length < MAX_HAND_SIZE; i++) {
    const refilled = refillDeck(nextDeck, nextDiscard);
    if (!refilled) break;
    nextDeck = refilled.deck;
    nextDiscard = refilled.discard;

    const card = nextDeck.shift();
    if (card) {
      nextHand.push({ ...card, uid });
      uid += 1;
    }
  }

  return { deck: nextDeck, discard: nextDiscard, hand: nextHand, nextCardUid: uid };
}

/**
 * Computes scaled health for the enemy, applying room scaling and type multipliers.
 */
function scaleEnemyHealth(enemy: BestiaryEntry, roomMul: number): number {
  const hpTypeMul =
    enemy.enemyType === "elite" ? ELITE_HP_MULTIPLIER : enemy.enemyType === "boss" ? BOSS_HEALTH_MULTIPLIER : 1;
  return Math.round(BASE_ENEMY_HEALTH * roomMul * hpTypeMul);
}

/**
 * Computes room-scaled attack effects for the enemy, applying fallback damage if empty.
 */
function scaleAttackEffects(effects: EnemyAttackEffect[], roomMul: number): EnemyAttackEffect[] {
  const baseEffects =
    effects.length > 0
      ? effects
      : [{ kind: "damage" as const, damageType: "physical" as const, amount: FALLBACK_ENEMY_ATTACK }];

  return baseEffects.map((effect) => {
    const scaledAmount = Math.round(effect.amount * roomMul);
    if (effect.kind === "damage") {
      return {
        kind: "damage",
        damageType: effect.damageType,
        amount: scaledAmount,
        ...("lifesteal" in effect ? { lifesteal: effect.lifesteal } : {}),
      };
    }
    return { kind: "player-status", status: effect.status, amount: scaledAmount };
  });
}

/**
 * Resolves baseline enemy regeneration based on traits and enemy type.
 */
function scaleEnemyRegeneration(enemy: BestiaryEntry): number {
  if (!enemy.traits.some((t) => t.id === "regeneration")) return 0;
  return enemy.enemyType === "boss" ? ENEMY_BOSS_REGENERATION : ENEMY_BASE_REGENERATION;
}

/**
 * Enemy scaling using cumulative rooms across the entire run (no per-act reset).
 * Health and regeneration scale by type, attacks by room scaling factor.
 */
function buildScaledEnemy(enemy: BestiaryEntry, totalRoomsInRun = 0) {
  const scaler = Math.max(0, totalRoomsInRun - 1);
  const roomMul = 1 + scaler * ROOM_SCALING_INCREMENT;

  return {
    enemy,
    scaledEnemyHealth: scaleEnemyHealth(enemy, roomMul),
    scaledEnemyAttackEffects: scaleAttackEffects(enemy.attackEffects, roomMul),
    enemyRegeneration: scaleEnemyRegeneration(enemy),
  };
}

/**
 * Sets up opening card hands, considering extra draw trinkets.
 */
function setupOpeningHand(deck: BattleCard[], trinketEffects: ReturnType<typeof computeTrinketManifest>) {
  const openingHand = drawCards(shuffleCards(deck), [], [], CARDS_PER_TURN, 0);
  if (trinketEffects.extraDrawPerBattle <= 0) return { ...openingHand, extraHand: null };
  const extraHand = drawCards(
    openingHand.deck,
    openingHand.discard,
    openingHand.hand,
    trinketEffects.extraDrawPerBattle,
    openingHand.nextCardUid,
  );
  return {
    deck: extraHand.deck,
    hand: extraHand.hand,
    discard: extraHand.discard,
    nextCardUid: extraHand.nextCardUid,
    extraHand,
  };
}

/**
 * Transforms enemy attack effects based on campaign/difficulty modifiers.
 */
function applyDifficultyAttackModifiers(effects: EnemyAttackEffect[], modifiers: DifficultyModifier[]) {
  let modified = [...effects];
  for (const mod of modifiers) {
    if (mod.kind === "increase-enemy-physical-damage" || mod.kind === "increase-enemy-damage") {
      modified = modified.map((e) => (e.kind === "damage" ? { ...e, amount: e.amount + mod.amount } : e));
    }
    if (mod.kind === "increase-enemy-status") {
      modified = modified.map((e) =>
        e.kind === "player-status" && e.status === mod.status ? { ...e, amount: e.amount + mod.amount } : e,
      );
    }
    if (mod.kind === "enemy-attacks-gain-leech") {
      modified = modified.map((e) => (e.kind === "damage" ? { ...e, lifesteal: true } : e));
    }
  }
  return modified;
}

/**
 * Resolves starting player/enemy values modified by difficulty modes.
 */
function computeStartingStatuses(modifiers: DifficultyModifier[], enemy: BestiaryEntry) {
  const startingArmor = modifiers.find((m) => m.kind === "enemy-starting-armor")?.amount ?? 0;
  const traitStartingArmor = enemy.traits.some((t) => t.id === "living-armor") ? LIVING_ARMOR_STARTING_ARMOR : 0;
  const startBlock = modifiers.find((m) => m.kind === "start-block")?.amount ?? 0;
  const manaBonus = modifiers.find((m) => m.kind === "start-max-mana")?.amount ?? 0;
  const startCompanion = modifiers.some((m) => m.kind === "start-companion");
  return { startingArmor: startingArmor + traitStartingArmor, startBlock, manaBonus, startCompanion };
}

export type CreateBattleStateOptions = {
  runDeck: BattleCard[];
  gold?: number;
  totalRooms?: number;
  currentEnemy: BestiaryEntry;
  playerHealth?: number;
  talentEffects?: TalentEffectManifest;
  discoveredCardIds?: string[];
  maxHealth?: number;
  trinketIds?: string[];
  difficultyModifiers?: DifficultyModifier[];
};

/**
 * Normalizes options parameter signature variations.
 */
function parseCreateBattleStateOptions(
  optionsOrRunDeck: CreateBattleStateOptions | BattleCard[],
  gold = 0,
  totalRooms = 0,
  currentEnemy?: BestiaryEntry,
  playerHealth = MAX_PLAYER_HEALTH,
  talentEffects: TalentEffectManifest = defaultTalentEffects,
  discoveredCardIds: string[] = [],
  maxHealth = MAX_PLAYER_HEALTH,
  trinketIds: string[] = [],
  difficultyModifiers: DifficultyModifier[] = [],
): CreateBattleStateOptions {
  return Array.isArray(optionsOrRunDeck)
    ? {
        runDeck: optionsOrRunDeck,
        gold,
        totalRooms,
        currentEnemy: currentEnemy!,
        playerHealth,
        talentEffects,
        discoveredCardIds,
        maxHealth,
        trinketIds,
        difficultyModifiers,
      }
    : optionsOrRunDeck;
}

/**
 * Calculates initial player health and block taking talents and difficulty modifiers into account.
 */
function initializePlayerHealthAndBlock(
  options: CreateBattleStateOptions,
  talentEffects: TalentEffectManifest,
  startBlock: number,
) {
  const maxHealth = options.maxHealth ?? MAX_PLAYER_HEALTH;
  const playerHealth = options.playerHealth ?? MAX_PLAYER_HEALTH;
  const startingHealth = Math.min(maxHealth, playerHealth + talentEffects.startHealth);
  const startingBlock = talentEffects.startBlock + startBlock;
  const startingArmor = talentEffects.startArmor;
  return { startingHealth, maxHealth, startingBlock, startingArmor };
}

function initializeEnemyState(battleEnemy: BestiaryEntry, battleRooms: number, battleDiffs: DifficultyModifier[]) {
  const { scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration } = buildScaledEnemy(battleEnemy, battleRooms);
  const modifiedEffects = applyDifficultyAttackModifiers(scaledEnemyAttackEffects, battleDiffs);
  const { startingArmor, startBlock, manaBonus, startCompanion } = computeStartingStatuses(battleDiffs, battleEnemy);

  const hasSturdy = battleDiffs.some((m) => m.kind === "labyrinth-sturdy");
  const enemyMaxHealth = hasSturdy ? Math.round(scaledEnemyHealth * LABYRINTH_STURDY_MULTIPLIER) : scaledEnemyHealth;

  return {
    enemyMaxHealth,
    modifiedEffects,
    enemyRegeneration,
    startingArmor,
    startBlock,
    manaBonus,
    startCompanion,
  };
}

function buildInitialBattleState(
  baseState: BattleState,
  setup: {
    deck: BattleCard[];
    hand: BattleCard[];
    discard: BattleCard[];
    mana: number;
    gold: number;
    playerHealth: number;
    playerMaxHealth: number;
    enemyHealth: number;
    enemyAttackEffects: EnemyAttackEffect[];
    enemyRegeneration: number;
    enemyArmor: number; // folded into enemyMitigation at build time
    startingBlock: number;
    startingArmor: number;
    activeCompanion: CompanionDefinition | null;
    currentEnemy: BestiaryEntry;
    talentEffects: TalentEffectManifest;
    trinketEffects: ReturnType<typeof computeTrinketManifest>;
    discoveredCardIds: string[];
    nextCardUid: number;
    difficultyModifiers: DifficultyModifier[];
  },
): BattleState {
  return {
    ...baseState,
    deck: setup.deck,
    hand: setup.hand,
    discard: setup.discard,
    mana: setup.mana,
    maxMana: setup.mana,
    gold: setup.gold,
    turnPhase: "player" as TurnPhase,
    playerHealth: setup.playerHealth,
    playerMaxHealth: setup.playerMaxHealth,
    enemyHealth: setup.enemyHealth,
    enemyMaxHealth: setup.enemyHealth,
    enemyAttackEffects: setup.enemyAttackEffects,
    enemyRegeneration: setup.enemyRegeneration,
    enemyMitigation: { armor: setup.enemyArmor, forge: 0, freezeBonus: 0 },
    playerStatuses: {
      ...baseState.playerStatuses,
      block: setup.startingBlock,
      forge: setup.talentEffects.startForge,
    },
    enemyStatuses: baseState.enemyStatuses,
    activeCompanion: setup.activeCompanion,
    currentEnemy: setup.currentEnemy,
    talentEffects: setup.talentEffects,
    trinketEffects: setup.trinketEffects,
    flags: baseState.flags,
    discoveredCardIds: setup.discoveredCardIds,
    nextCardUid: setup.nextCardUid,
    difficultyModifiers: setup.difficultyModifiers,
  };
}

export function createBattleState(options: CreateBattleStateOptions): BattleState;
export function createBattleState(
  runDeck: BattleCard[],
  gold?: number,
  totalRooms?: number,
  currentEnemy?: BestiaryEntry,
  playerHealth?: number,
  talentEffects?: TalentEffectManifest,
  discoveredCardIds?: string[],
  maxHealth?: number,
  trinketIds?: string[],
  difficultyModifiers?: DifficultyModifier[],
): BattleState;
export function createBattleState(
  optionsOrRunDeck: CreateBattleStateOptions | BattleCard[],
  gold = 0,
  totalRooms = 0,
  currentEnemy?: BestiaryEntry,
  playerHealth = MAX_PLAYER_HEALTH,
  talentEffects: TalentEffectManifest = defaultTalentEffects,
  discoveredCardIds: string[] = [],
  maxHealth = MAX_PLAYER_HEALTH,
  trinketIds: string[] = [],
  difficultyModifiers: DifficultyModifier[] = [],
): BattleState {
  const options = parseCreateBattleStateOptions(
    optionsOrRunDeck,
    gold,
    totalRooms,
    currentEnemy,
    playerHealth,
    talentEffects,
    discoveredCardIds,
    maxHealth,
    trinketIds,
    difficultyModifiers,
  );

  const {
    runDeck,
    gold: battleGold = 0,
    totalRooms: battleRooms = 0,
    currentEnemy: battleEnemy,
    talentEffects: battleTalents = defaultTalentEffects,
    discoveredCardIds: battleDiscovered = [],
    trinketIds: battleTrinkets = [],
    difficultyModifiers: battleDiffs = [],
  } = options;

  if (!battleEnemy) {
    throw new Error("createBattleState requires currentEnemy; use defaultBattleState for inactive placeholder state.");
  }

  const trinketEffects = computeTrinketManifest(battleTrinkets);
  const { deck, hand, discard, nextCardUid } = setupOpeningHand(runDeck, trinketEffects);

  const { enemyMaxHealth, modifiedEffects, enemyRegeneration, startingArmor, startBlock, manaBonus, startCompanion } =
    initializeEnemyState(battleEnemy, battleRooms, battleDiffs);

  const {
    startingHealth,
    maxHealth: finalMaxHealth,
    startingBlock,
    startingArmor: playerStartingArmor,
  } = initializePlayerHealthAndBlock(options, battleTalents, startBlock);

  return buildInitialBattleState(defaultBattleState(), {
    deck,
    hand,
    discard,
    mana: BASE_PLAYER_MANA + manaBonus,
    gold: battleGold,
    playerHealth: startingHealth,
    playerMaxHealth: finalMaxHealth,
    enemyHealth: enemyMaxHealth,
    enemyAttackEffects: modifiedEffects,
    enemyRegeneration,
    enemyArmor: startingArmor,
    startingBlock,
    startingArmor: playerStartingArmor,
    activeCompanion: startCompanion ? companionLibrary["wolf"] : null,
    currentEnemy: battleEnemy,
    talentEffects: battleTalents,
    trinketEffects,
    discoveredCardIds: battleDiscovered,
    nextCardUid,
    difficultyModifiers: battleDiffs,
  });
}

export function shuffleCards(cards: BattleCard[]) {
  return shuffle(cards);
}
