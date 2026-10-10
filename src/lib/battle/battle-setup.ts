import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { applyHealingWithCombatText } from "./player-rewards";
import { addForgeToPlayer, applyArmorReward, applyBlockReward } from "./status-player";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
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
import type { BattleState, EnemyMitigation } from "./types";
import { EMPTY_ENEMY_MITIGATION } from "./enemy-mitigation-state";
import { isPlayerDefeated } from "./health-state";
import { applyEmergencyWish } from "./wish";
import { computeTrinketManifest } from "../trinkets";
import { applyDrawResult, drawCards, drawKeywordCard } from "./draw";
import { defaultBattleState, defaultTalentEffects } from "./battle-setup-defaults";
import { initializeEnemyState } from "./battle-enemy-setup";
import { placeholderRng, shuffle, getBattleRng } from "@/lib/rng";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
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
  encounterBenefits?: EncounterRewardTraitId[];
}

function initializePlayerHealthAndBlock(
  options: CreateBattleStateOptions,
  talentEffects: TalentEffectManifest,
  startBlock: number,
  gearEffects: GearEffectManifest,
) {
  const maxHealth = options.maxHealth ?? MAX_PLAYER_HEALTH;
  const playerHealth = options.playerHealth ?? MAX_PLAYER_HEALTH;
  const startingHealth = Math.min(maxHealth, playerHealth);
  const startingBlock = talentEffects.startBlock + startBlock + gearEffects.startBlock;
  const startingArmor = talentEffects.startArmor + gearEffects.startArmor;
  return { startingHealth, maxHealth, startingBlock, startingArmor };
}

export function drawOpeningHand(state: BattleState): BattleState {
  const drawn = applyDrawResult(
    state,
    drawCards(
      state.deck,
      state.discard,
      state.hand,
      CARDS_PER_TURN + state.trinketEffects.extraDrawPerBattle,
      state.nextCardUid,
      getBattleRng(state),
    ),
  );
  return drawn.enemyHealth > 0 &&
    !isPlayerDefeated(drawn) &&
    !drawn.wishOptions &&
    drawn.hand.length === 0 &&
    drawn.deck.length === 0 &&
    drawn.discard.length === 0
    ? resolvePendingBattleReactions(applyEmergencyWish(drawn), [])
    : drawn;
}

function resolveStartingEnemyMitigation(
  traits: BestiaryEntry["traits"],
  startingArmor: number,
  startingBlock: number,
): EnemyMitigation {
  const hasFortress = traits.some((trait) => trait.id === "iron-fortress");
  return {
    ...EMPTY_ENEMY_MITIGATION,
    armor: startingArmor + (hasFortress ? LABYRINTH_MODIFIER_CONFIG.fortressArmor : 0),
    block: startingBlock,
  };
}

function resolveStartingPlayerStatuses(
  baseStatuses: BattleState["playerStatuses"],
  encounterBenefits: string[],
  battleTalents: TalentEffectManifest,
  battleGearEffects: BattleState["gearEffects"],
  startingBlock: number,
  playerStartingArmor: number,
  mana: number,
): BattleState["playerStatuses"] {
  const startingArmor = playerStartingArmor + (battleTalents.manaShellActive ? mana : 0);
  return {
    ...baseStatuses,
    phoenixFeather: encounterBenefits.includes("phoenix-nest") ? 1 : 0,
    thorns:
      (encounterBenefits.includes("bramblecoat") ? LABYRINTH_MODIFIER_CONFIG.playerThornsMinimum : 0) +
      battleGearEffects.startThorns,
    block: startingBlock + (battleTalents.manaBulwarkActive ? mana : 0),
    forge: battleTalents.startForge + battleGearEffects.startForge,
    armor: startingArmor,
  };
}

function resolveStartingEnemyThorns(traits: BestiaryEntry["traits"]): number {
  if (traits.some((trait) => trait.id === "briar-crown")) return LABYRINTH_MODIFIER_CONFIG.bossThornsMinimum;
  if (traits.some((trait) => trait.id === "thornhide")) return LABYRINTH_MODIFIER_CONFIG.enemyThornsMinimum;
  if (traits.some((trait) => trait.id === "thorns")) return 1;
  return 0;
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

  const encounterBenefits = battleContentSystem === "labyrinth" ? (options.encounterBenefits ?? []) : [];
  const mana = BASE_PLAYER_MANA + manaBonus + battleTalents.startMana + battleTalents.runMaxManaBonus;
  const baseState = defaultBattleState();
  const openingStatuses = resolveStartingPlayerStatuses(
    baseState.playerStatuses,
    encounterBenefits,
    battleTalents,
    battleGearEffects,
    startingBlock,
    playerStartingArmor,
    mana,
  );
  const state: BattleState = {
    ...baseState,
    deck,
    hand: [],
    discard: [],
    mana: mana + (encounterBenefits.includes("wellspring") ? LABYRINTH_MODIFIER_CONFIG.manaBonus : 0),
    maxMana: mana,
    encounterBenefits,
    gold: battleGold,
    turnPhase: "player",
    playerHealth: startingHealth,
    playerMaxHealth: finalMaxHealth,
    enemyHealth: enemyMaxHealth,
    enemyMaxHealth,
    enemyRegeneration,
    roomScalingMultiplier,
    enemyMitigation: resolveStartingEnemyMitigation(battleEnemy.traits, startingArmor, startingEnemyBlock),
    playerStatuses: { ...openingStatuses, forge: 0, armor: 0, block: 0 },
    enemyStatuses: {
      ...baseState.enemyStatuses,
      thorns: resolveStartingEnemyThorns(battleEnemy.traits),
    },
    activeCompanion: startCompanion ? (companionLibrary[startCompanionId] ?? companionLibrary["wolf"]) : null,
    currentEnemy: battleEnemy,
    talentEffects: battleTalents,
    trinketEffects,
    gearEffects: battleGearEffects,
    flags: { ...baseState.flags, legacyEnemyThornsReady: battleEnemy.traits.some((trait) => trait.id === "thorns") },
    discoveredCardIds: battleDiscovered,
    nextCardUid: 0,
    difficultyModifiers: battleDiffs,
    rng: activeRng,
    contentSystemType: battleContentSystem,
    appliesFightPacing: battleAppliesFightPacing,
  };
  // Opening grants use the ordinary gain owners, without fight pacing. Forge
  // precedes Block so Tempered Guard sees the Forge already granted.
  let equipped = state;
  const openingForge = openingStatuses.forge + (equipped.encounterBenefits.includes("white-heat") ? 2 : 0);
  if (openingForge > 0) equipped = addForgeToPlayer(equipped, openingForge, []);
  if (openingStatuses.armor > 0) equipped = applyArmorReward(equipped, openingStatuses.armor, []);
  if (openingStatuses.block > 0)
    equipped = applyBlockReward(equipped, openingStatuses.block, [], { skipFightPacing: true });
  const healedState = resolvePendingBattleReactions(
    applyHealingWithCombatText(equipped, battleTalents.startHealth + battleGearEffects.startHeal, [], {
      skipFightPacing: true,
    }),
    [],
  );
  const startFreeze = battleGearEffects.startFreeze;
  let started = healedState;
  if (startFreeze > 0 && started.enemyHealth > 0 && started.playerHealth > 0) {
    started = resolvePendingBattleReactions(
      resolveFollowUpHit(started, { source: "player-follow-up", damageType: "freeze", amount: startFreeze }, []),
      [],
    );
  }
  if (started.enemyHealth <= 0 || started.playerHealth <= 0 || !battleTalents.drawNatureCardAtCombatStart)
    return started;
  return drawKeywordCard(started, "nature");
}

export function createBattleState(options: CreateBattleStateOptions): BattleState {
  return drawOpeningHand(createBattleStartState(options));
}
