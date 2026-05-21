// Deck drawing and battle-state creation for new encounters.
// Depends on game data, combat constants, talent manifests, and trinket manifests.
// Used by turn logic and battle controllers whenever cards or fresh battles are needed.
import { companionLibrary, createEmptyTalentManifest } from "@/lib/game-data";
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
    playerHealth: 30,
    playerMaxHealth: 30,
    deathsDoorUsed: false,
    deathsDoorActive: false,
    deathsDoorTriggeredTurn: null,
    enemyHealth: 30,
    enemyMaxHealth: 30,
    enemyAttackEffects: [],
    enemyArmor: 0,
    enemyForge: 0,
    enemyFreezeBonus: 0,
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

// Returns a fresh (deck, discard) pair after possibly reshuffling discard into deck.
function refillDeck(deck: BattleCard[], discard: BattleCard[]) {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffleCards(discard), discard: [] };
}

// Draws cards from the deck into the hand. If the deck runs out, the discard pile
// is shuffled back into the deck. Stops at maxHandSize.
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

// Enemy scaling using cumulative rooms across the entire run (no per-act reset).
// Only Health scales by enemy type constants. Attack scales by room alone.
function buildScaledEnemy(enemy: BestiaryEntry, totalRoomsInRun = 0) {
  const scaler = Math.max(0, totalRoomsInRun - 1);
  const roomMul = 1 + scaler * ROOM_SCALING_INCREMENT;
  const hpTypeMul =
    enemy.enemyType === "elite" ? ELITE_HP_MULTIPLIER : enemy.enemyType === "boss" ? BOSS_HEALTH_MULTIPLIER : 1;
  const scaledEnemyHealth = Math.round(BASE_ENEMY_HEALTH * roomMul * hpTypeMul);
  const scaleAmount = (amount: number) => Math.round(amount * roomMul);

  const baseEffects =
    enemy.attackEffects.length > 0
      ? enemy.attackEffects
      : [{ kind: "damage" as const, damageType: "physical" as const, amount: FALLBACK_ENEMY_ATTACK }];
  const scaledEnemyAttackEffects: EnemyAttackEffect[] = baseEffects.map((effect) => {
    if (effect.kind === "damage") {
      return {
        kind: "damage",
        damageType: effect.damageType,
        amount: scaleAmount(effect.amount),
        ...("lifesteal" in effect ? { lifesteal: effect.lifesteal } : {}),
      };
    }
    return { kind: "player-status", status: effect.status, amount: scaleAmount(effect.amount) };
  });
  const regenBase = enemy.traits.some((t) => t.id === "regeneration")
    ? enemy.enemyType === "boss"
      ? ENEMY_BOSS_REGENERATION
      : ENEMY_BASE_REGENERATION
    : 0;
  const enemyRegeneration = regenBase;

  return { enemy, scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration };
}

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

// Creates the initial BattleState for a fresh encounter. Enemy Health and attack
// scale by cumulative rooms across the run (10% per room after the first). Type
// multipliers (Elite 1.5×, Boss 2×) only affect Health. Delegates to focused
// helpers for opening hand, enemy scaling, difficulty modifiers, and status setup.
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
  const options = Array.isArray(optionsOrRunDeck)
    ? {
        runDeck: optionsOrRunDeck,
        gold,
        totalRooms,
        currentEnemy,
        playerHealth,
        talentEffects,
        discoveredCardIds,
        maxHealth,
        trinketIds,
        difficultyModifiers,
      }
    : optionsOrRunDeck;

  const {
    runDeck,
    gold: battleGold = 0,
    totalRooms: battleTotalRooms = 0,
    currentEnemy: battleEnemy,
    playerHealth: battlePlayerHealth = MAX_PLAYER_HEALTH,
    talentEffects: battleTalentEffects = defaultTalentEffects,
    discoveredCardIds: battleDiscoveredCardIds = [],
    maxHealth: battleMaxHealth = MAX_PLAYER_HEALTH,
    trinketIds: battleTrinketIds = [],
    difficultyModifiers: battleDifficultyModifiers = [],
  } = options;

  const trinketEffects = computeTrinketManifest(battleTrinketIds);
  const { deck, hand, discard, nextCardUid } = setupOpeningHand(runDeck, trinketEffects);

  if (!battleEnemy) {
    throw new Error("createBattleState requires currentEnemy; use defaultBattleState for inactive placeholder state.");
  }

  const enemy = battleEnemy;
  const { scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration } = buildScaledEnemy(enemy, battleTotalRooms);
  const modifiedEffects = applyDifficultyAttackModifiers(scaledEnemyAttackEffects, battleDifficultyModifiers);
  const { startingArmor, startBlock, manaBonus, startCompanion } = computeStartingStatuses(
    battleDifficultyModifiers,
    enemy,
  );

  const hasSturdy = battleDifficultyModifiers.some((m) => m.kind === "labyrinth-sturdy");
  const enemyMaxHealth = hasSturdy ? Math.round(scaledEnemyHealth * LABYRINTH_STURDY_MULTIPLIER) : scaledEnemyHealth;

  const startingHealth = Math.min(battleMaxHealth, battlePlayerHealth + battleTalentEffects.startHealth);
  const baseState = defaultBattleState();

  return {
    ...baseState,
    deck,
    hand,
    discard,
    mana: BASE_PLAYER_MANA + manaBonus,
    maxMana: BASE_PLAYER_MANA + manaBonus,
    gold: battleGold,
    turnPhase: "player" as TurnPhase,
    playerHealth: startingHealth,
    playerMaxHealth: battleMaxHealth,
    enemyHealth: enemyMaxHealth,
    enemyMaxHealth: enemyMaxHealth,
    enemyAttackEffects: modifiedEffects,
    enemyRegeneration,
    enemyArmor: startingArmor,
    playerStatuses: {
      ...createEmptyPlayerStatuses(),
      block: battleTalentEffects.startBlock + startBlock,
      armor: 0,
      forge: 0,
      haste: 0,
      burn: 0,
      poison: 0,
      bleed: 0,
      freeze: 0,
      stun: 0,
    },
    enemyStatuses: createEmptyEnemyStatuses(),
    activeCompanion: startCompanion ? companionLibrary["wolf"] : null,
    currentEnemy: enemy,
    talentEffects: battleTalentEffects,
    trinketEffects,
    flags: createInitialFlags(),
    discoveredCardIds: battleDiscoveredCardIds,
    nextCardUid,
    difficultyModifiers: battleDifficultyModifiers,
  };
}

export function shuffleCards(cards: BattleCard[]) {
  return shuffle(cards);
}
