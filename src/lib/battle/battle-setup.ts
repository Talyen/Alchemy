/**
 * Battle state factory: wires defaults, enemy setup, and createBattleState.
 * Depends on: ./battle-setup-defaults, ./battle-enemy-setup, ./draw, @/lib/game-data, ../game-constants.
 */
import {
  companionLibrary,
  type BattleCard,
  type BestiaryEntry,
  type CompanionDefinition,
  type DifficultyModifier,
  type EnemyAttackEffect,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { BASE_PLAYER_MANA, CARDS_PER_TURN, MAX_PLAYER_HEALTH } from "../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import { defaultGearEffects } from "@/lib/gear";
import { EMPTY_ENEMY_MITIGATION, type BattleState } from "./types";
import { computeTrinketManifest } from "../trinkets";
import { drawCards, shuffleCards } from "./draw";
import { defaultBattleState, defaultTalentEffects } from "./battle-setup-defaults";
import { initializeEnemyState } from "./battle-enemy-setup";
import { unsafeNonSeededRng } from "./rng";

export { defaultBattleState, defaultTalentEffects } from "./battle-setup-defaults";

function setupOpeningHand(deck: BattleCard[], extraDrawPerBattle: number, rng: () => number = unsafeNonSeededRng) {
  const openingHand = drawCards(shuffleCards(deck, rng), [], [], CARDS_PER_TURN, 0, rng);
  if (extraDrawPerBattle <= 0) return openingHand;
  return drawCards(
    openingHand.deck,
    openingHand.discard,
    openingHand.hand,
    extraDrawPerBattle,
    openingHand.nextCardUid,
    rng,
  );
}

export interface CreateBattleStateOptions {
  runDeck: BattleCard[];
  gold?: number;
  totalRooms?: number;
  currentEnemy: BestiaryEntry;
  playerHealth?: number;
  talentEffects?: TalentEffectManifest;
  discoveredCardIds?: string[];
  maxHealth?: number;
  trinketIds?: string[];
  gearEffects?: GearEffectManifest;
  difficultyModifiers?: DifficultyModifier[];
  rng?: () => number;
}

function initializePlayerHealthAndBlock(
  options: CreateBattleStateOptions,
  talentEffects: TalentEffectManifest,
  startBlock: number,
  gearEffects: GearEffectManifest,
) {
  const maxHealth = options.maxHealth ?? MAX_PLAYER_HEALTH;
  const playerHealth = options.playerHealth ?? MAX_PLAYER_HEALTH;
  const startingHealth = Math.min(maxHealth, playerHealth + talentEffects.startHealth + gearEffects.startHeal);
  const baseBlock = talentEffects.startBlock + startBlock + gearEffects.startBlock;
  const startingBlock = baseBlock > 0 ? baseBlock + gearEffects.flatBlockGained : 0;
  const startingArmor = talentEffects.startArmor + gearEffects.startArmor;
  return { startingHealth, maxHealth, startingBlock, startingArmor };
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
    enemyArmor: number;
    startingBlock: number;
    startingArmor: number;
    startingEnemyBlock: number;
    activeCompanion: CompanionDefinition | null;
    currentEnemy: BestiaryEntry;
    talentEffects: TalentEffectManifest;
    trinketEffects: ReturnType<typeof computeTrinketManifest>;
    gearEffects: GearEffectManifest;
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
    turnPhase: "player",
    playerHealth: setup.playerHealth,
    playerMaxHealth: setup.playerMaxHealth,
    enemyHealth: setup.enemyHealth,
    enemyMaxHealth: setup.enemyHealth,
    enemyAttackEffects: setup.enemyAttackEffects,
    enemyRegeneration: setup.enemyRegeneration,
    roomScalingMultiplier: setup.roomScalingMultiplier,
    enemyMitigation: {
      ...EMPTY_ENEMY_MITIGATION,
      armor: setup.enemyArmor,
      block: setup.startingEnemyBlock,
    },
    playerStatuses: {
      ...baseState.playerStatuses,
      block: setup.startingBlock + (setup.talentEffects.manaBulwarkActive ? setup.mana : 0),
      forge: setup.talentEffects.startForge + setup.gearEffects.startForge,
      armor: setup.startingArmor + (setup.talentEffects.manaShellActive ? setup.mana : 0),
    },
    enemyStatuses: {
      ...baseState.enemyStatuses,
      freeze: setup.talentEffects.startFreeze + setup.gearEffects.startFreeze,
    },
    activeCompanion: setup.activeCompanion,
    currentEnemy: setup.currentEnemy,
    talentEffects: setup.talentEffects,
    trinketEffects: setup.trinketEffects,
    gearEffects: setup.gearEffects,
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
    trinketIds: battleBoons = [],
    gearEffects: battleGearEffects = defaultGearEffects,
    difficultyModifiers: battleDiffs = [],
    rng: optionsRng,
  } = options;

  if (!battleEnemy) {
    throw new Error("createBattleState requires currentEnemy; use defaultBattleState for inactive placeholder state.");
  }

  const trinketEffects = computeTrinketManifest(battleBoons);
  const activeRng = optionsRng ?? unsafeNonSeededRng;
  const { deck, hand, discard, nextCardUid } = setupOpeningHand(runDeck, trinketEffects.extraDrawPerBattle, activeRng);

  const {
    enemyMaxHealth,
    modifiedEffects,
    enemyRegeneration,
    roomScalingMultiplier,
    startingArmor,
    startBlock,
    manaBonus,
    startCompanion,
    startingEnemyBlock,
  } = initializeEnemyState(battleEnemy, battleRooms, battleDiffs);

  const {
    startingHealth,
    maxHealth: finalMaxHealth,
    startingBlock,
    startingArmor: playerStartingArmor,
  } = initializePlayerHealthAndBlock(options, battleTalents, startBlock, battleGearEffects);

  return buildInitialBattleState(defaultBattleState(), {
    deck,
    hand,
    discard,
    mana: BASE_PLAYER_MANA + manaBonus + battleTalents.startMana + battleTalents.runMaxManaBonus,
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
    startingEnemyBlock,
    activeCompanion: startCompanion ? companionLibrary["wolf"] : null,
    currentEnemy: battleEnemy,
    talentEffects: battleTalents,
    trinketEffects,
    gearEffects: battleGearEffects,
    discoveredCardIds: battleDiscovered,
    nextCardUid,
    difficultyModifiers: battleDiffs,
    rng: activeRng,
  });
}
