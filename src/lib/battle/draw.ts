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
  subtitle: "Placeholder — no battle should render this",
  descriptionLines: ["This enemy should never appear in an active battle."],
  art: "",
  enemyType: "normal" as const,
  traits: [],
  attackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: FALLBACK_ENEMY_ATTACK }],
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
    runicQuillUsedThisTurn: false,
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
    enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0, burnBonus: 0 },
    enemyRegeneration: 0,
    roomScalingMultiplier: 1,
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
    rng: Math.random,
  };
}

/**
 * Returns a fresh (deck, discard) pair after possibly reshuffling discard into deck.
 */
function refillDeck(deck: BattleCard[], discard: BattleCard[]): { deck: BattleCard[]; discard: BattleCard[] } | null {
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
    if (!card) break;
    nextHand.push({ ...card, uid });
    uid += 1;
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
 * Computes room-scaled attack effects for the enemy.
 */
function scaleAttackEffects(effects: EnemyAttackEffect[], roomMul: number): EnemyAttackEffect[] {
  return effects.map((effect) => {
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
 * Resolves baseline enemy regeneration based on traits and enemy type, scaled by room multiplier.
 */
function scaleEnemyRegeneration(enemy: BestiaryEntry, roomMul: number): number {
  if (!enemy.traits.some((t) => t.id === "regeneration")) return 0;
  const base = enemy.enemyType === "boss" ? ENEMY_BOSS_REGENERATION : ENEMY_BASE_REGENERATION;
  return Math.round(base * roomMul);
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
    enemyRegeneration: scaleEnemyRegeneration(enemy, roomMul),
  };
}

/**
 * Sets up opening card hands, considering extra draw from trinkets.
 */
function setupOpeningHand(deck: BattleCard[], extraDrawPerBattle: number) {
  const openingHand = drawCards(shuffleCards(deck), [], [], CARDS_PER_TURN, 0);
  if (extraDrawPerBattle <= 0) return { ...openingHand, extraHand: null };
  const extraHand = drawCards(
    openingHand.deck,
    openingHand.discard,
    openingHand.hand,
    extraDrawPerBattle,
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
  const dmgMul = modifiers.find((m) => m.kind === "enemy-damage-multiplier")?.amount ?? 1;
  if (dmgMul !== 1) {
    modified = modified.map((e) => (e.kind === "damage" ? { ...e, amount: Math.round(e.amount * dmgMul) } : e));
  }
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
function computeStartingStatuses(modifiers: DifficultyModifier[], enemy: BestiaryEntry, roomMul: number) {
  const startingArmor = modifiers.find((m) => m.kind === "enemy-starting-armor")?.amount ?? 0;
  const traitStartingArmor = enemy.traits.some((t) => t.id === "living-armor")
    ? Math.round(LIVING_ARMOR_STARTING_ARMOR * roomMul)
    : 0;
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
  rng?: () => number;
};

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
  const scaler = Math.max(0, battleRooms - 1);
  const roomMul = 1 + scaler * ROOM_SCALING_INCREMENT;
  const { startingArmor, startBlock, manaBonus, startCompanion } = computeStartingStatuses(
    battleDiffs,
    battleEnemy,
    roomMul,
  );

  const hasSturdy = battleDiffs.some((m) => m.kind === "labyrinth-sturdy");
  const hpMul = battleDiffs.find((m) => m.kind === "enemy-health-multiplier")?.amount ?? 1;
  const totalMul = (hasSturdy ? LABYRINTH_STURDY_MULTIPLIER : 1) + (hpMul - 1);
  const enemyMaxHealth = Math.round(scaledEnemyHealth * totalMul);

  return {
    enemyMaxHealth,
    modifiedEffects,
    enemyRegeneration,
    roomScalingMultiplier: roomMul,
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
    roomScalingMultiplier: number;
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
    rng: () => number;
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
    roomScalingMultiplier: setup.roomScalingMultiplier,
    enemyMitigation: { armor: setup.enemyArmor, forge: 0, freezeBonus: 0, burnBonus: 0 },
    playerStatuses: {
      ...baseState.playerStatuses,
      block: setup.startingBlock,
      forge: setup.talentEffects.startForge,
    },
    enemyStatuses: { ...baseState.enemyStatuses, freeze: setup.talentEffects.startFreeze },
    activeCompanion: setup.activeCompanion,
    currentEnemy: setup.currentEnemy,
    talentEffects: setup.talentEffects,
    trinketEffects: setup.trinketEffects,
    flags: baseState.flags,
    discoveredCardIds: setup.discoveredCardIds,
    nextCardUid: setup.nextCardUid,
    difficultyModifiers: setup.difficultyModifiers,
    rng: setup.rng,
  };
}

export function createBattleState(options: CreateBattleStateOptions): BattleState {
  const {
    runDeck,
    gold: battleGold = 0,
    totalRooms: battleRooms = 0,
    currentEnemy: battleEnemy,
    talentEffects: battleTalents = defaultTalentEffects,
    discoveredCardIds: battleDiscovered = [],
    trinketIds: battleTrinkets = [],
    difficultyModifiers: battleDiffs = [],
    rng: optionsRng,
  } = options;

  if (!battleEnemy) {
    throw new Error("createBattleState requires currentEnemy; use defaultBattleState for inactive placeholder state.");
  }

  const trinketEffects = computeTrinketManifest(battleTrinkets);
  const { deck, hand, discard, nextCardUid } = setupOpeningHand(runDeck, trinketEffects.extraDrawPerBattle);

  const {
    enemyMaxHealth,
    modifiedEffects,
    enemyRegeneration,
    roomScalingMultiplier,
    startingArmor,
    startBlock,
    manaBonus,
    startCompanion,
  } = initializeEnemyState(battleEnemy, battleRooms, battleDiffs);

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
    roomScalingMultiplier,
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
    rng: optionsRng ?? Math.random,
  });
}

export function shuffleCards(cards: BattleCard[]) {
  return shuffle(cards);
}
