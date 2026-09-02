import {
  companionLibrary,
  type BattleCard,
  type BestiaryEntry,
  type DifficultyModifier,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { BASE_PLAYER_MANA, CARDS_PER_TURN, MAX_PLAYER_HEALTH } from "../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import { defaultGearEffects } from "@/lib/gear";
import { EMPTY_ENEMY_MITIGATION, type BattleState } from "./types";
import { computeTrinketManifest } from "../trinkets";
import { applyDrawResult, drawCards } from "./draw";
import { shuffle } from "../utils";
import { defaultBattleState, defaultTalentEffects } from "./battle-setup-defaults";
import { initializeEnemyState } from "./battle-enemy-setup";
import { placeholderRng } from "../rng";
import { dealPlayerTypedHit } from "./player-typed-hit";
import type { ContentSystemId } from "@/lib/content-systems/types";

export { defaultBattleState, defaultTalentEffects } from "./battle-setup-defaults";

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
  contentSystemType?: ContentSystemId;
  appliesFightPacing?: boolean;
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

export function drawOpeningHand(state: BattleState): BattleState {
  return applyDrawResult(
    state,
    drawCards(
      state.deck,
      state.discard,
      state.hand,
      CARDS_PER_TURN + state.trinketEffects.extraDrawPerBattle,
      state.nextCardUid,
      state.rng,
    ),
  );
}

export function createBattleStartState(options: CreateBattleStateOptions): BattleState {
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
    contentSystemType: battleContentSystem = "campaign",
    appliesFightPacing: battleAppliesFightPacing = true,
  } = options;

  if (!battleEnemy) {
    throw new Error("createBattleState requires currentEnemy; use defaultBattleState for inactive placeholder state.");
  }

  const trinketEffects = computeTrinketManifest(battleBoons);

  if (!optionsRng && import.meta.env.PROD) {
    throw new Error("createBattleStartState requires rng in production; placeholderRng is UI-only.");
  }
  const activeRng = optionsRng ?? placeholderRng;
  const deck = shuffle(runDeck, activeRng);

  const {
    enemyMaxHealth,
    modifiedEffects,
    enemyRegeneration,
    roomScalingMultiplier,
    startingArmor,
    startBlock,
    manaBonus,
    startCompanion,
    startCompanionId,
    startingEnemyBlock,
  } = initializeEnemyState(battleEnemy, battleRooms, battleDiffs);

  const {
    startingHealth,
    maxHealth: finalMaxHealth,
    startingBlock,
    startingArmor: playerStartingArmor,
  } = initializePlayerHealthAndBlock(options, battleTalents, startBlock, battleGearEffects);

  const mana = BASE_PLAYER_MANA + manaBonus + battleTalents.startMana + battleTalents.runMaxManaBonus;
  const baseState = defaultBattleState();
  const state: BattleState = {
    ...baseState,
    deck,
    hand: [],
    discard: [],
    mana,
    maxMana: mana,
    gold: battleGold,
    turnPhase: "player",
    playerHealth: startingHealth,
    playerMaxHealth: finalMaxHealth,
    enemyHealth: enemyMaxHealth,
    enemyMaxHealth,
    enemyAttackEffects: modifiedEffects,
    enemyRegeneration,
    roomScalingMultiplier,
    enemyMitigation: {
      ...EMPTY_ENEMY_MITIGATION,
      armor: startingArmor,
      block: startingEnemyBlock,
    },
    playerStatuses: {
      ...baseState.playerStatuses,
      block: startingBlock + (battleTalents.manaBulwarkActive ? mana : 0),
      forge: battleTalents.startForge + battleGearEffects.startForge,
      armor: playerStartingArmor + (battleTalents.manaShellActive ? mana : 0),
    },
    enemyStatuses: {
      ...baseState.enemyStatuses,
    },
    activeCompanion: startCompanion ? (companionLibrary[startCompanionId] ?? companionLibrary["wolf"]) : null,
    currentEnemy: battleEnemy,
    talentEffects: battleTalents,
    trinketEffects,
    gearEffects: battleGearEffects,
    flags: baseState.flags,
    discoveredCardIds: battleDiscovered,
    nextCardUid: 0,
    difficultyModifiers: battleDiffs,
    rng: activeRng,
    contentSystemType: battleContentSystem,
    appliesFightPacing: battleAppliesFightPacing,
  };
  const startFreeze = battleTalents.startFreeze + battleGearEffects.startFreeze;
  if (startFreeze <= 0) return state;
  return dealPlayerTypedHit(state, "freeze", startFreeze, []);
}

export function createBattleState(options: CreateBattleStateOptions): BattleState {
  return drawOpeningHand(createBattleStartState(options));
}

export function getBattleStartPlayerHealth(runPlayerHealth: number, runMaxHealth: number, runBoons: string[]): number {
  const grovesHeal = computeTrinketManifest(runBoons).grovesFavorStartHeal;
  return grovesHeal > 0 ? Math.min(runMaxHealth, runPlayerHealth + grovesHeal) : runPlayerHealth;
}
