import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { applyHealingWithCombatText } from "./player-rewards";
import { addForgeToPlayer, applyArmorReward, applyBlockReward } from "./status-player";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import {
  companionLibrary,
  createEmptyTalentEffectManifest,
  type BattleCard,
  type BestiaryEntry,
  type DifficultyModifier,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { BASE_PLAYER_MANA, CARDS_PER_TURN, MAX_PLAYER_HEALTH } from "../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import { createEmptyGearEffectManifest } from "@/lib/gear";
import type { BattleState, CombatTextEvent, EnemyMitigation } from "./types";
import { EMPTY_ENEMY_MITIGATION } from "./enemy-mitigation-state";
import { getBattleOutcome } from "./battle-outcome";
import { applyEmergencyWish } from "./wish";
import { computeTrinketManifest } from "../trinkets";
import { applyDrawResult, drawCards, drawKeywordCard } from "./draw";
import { defaultBattleState } from "./battle-setup-defaults";
import { initializeEnemyState } from "./battle-enemy-setup";
import { shuffle, getBattleRng } from "@/lib/rng";
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
  trackMetrics?: boolean;
}

export function drawOpeningHand(state: BattleState, combatTexts: CombatTextEvent[] = []): BattleState {
  if (getBattleOutcome(state) !== null) return state;
  const drawn = applyDrawResult(
    state,
    drawCards(
      state.deck,
      state.discard,
      state.hand,
      CARDS_PER_TURN + state.trinketEffects.extraDrawPerBattle,
      state.nextCardUid,
      getBattleRng(state),
      state.pendingHandCards,
    ),
  );
  return getBattleOutcome(drawn) === null &&
    !drawn.wishOptions &&
    drawn.hand.length === 0 &&
    drawn.deck.length === 0 &&
    drawn.discard.length === 0
    ? resolvePendingBattleReactions(applyEmergencyWish(drawn, combatTexts), combatTexts)
    : drawn;
}

function resolveStartingEnemyMitigation(
  traits: BestiaryEntry["traits"],
  startingArmor: number,
  startingBlock: number,
): EnemyMitigation {
  let hasFortress = false;
  let hasWhitehot = false;
  traits.some((trait) => {
    if (trait.id === "iron-fortress") hasFortress = true;
    else if (trait.id === "whitehot") hasWhitehot = true;
    return hasFortress && hasWhitehot;
  });
  return {
    ...EMPTY_ENEMY_MITIGATION,
    armor: startingArmor + (hasFortress ? LABYRINTH_MODIFIER_CONFIG.fortressArmor : 0),
    block: startingBlock,
    forge: hasWhitehot ? LABYRINTH_MODIFIER_CONFIG.whitehotForge : 0,
  };
}

function resolveStartingEnemyThorns(traits: BestiaryEntry["traits"]): number {
  let thorns = 0;
  for (const trait of traits) {
    if (trait.id === "briar-crown") return LABYRINTH_MODIFIER_CONFIG.bossThornsMinimum;
    if (trait.id === "thornhide") thorns = LABYRINTH_MODIFIER_CONFIG.enemyThornsMinimum;
    else if (trait.id === "thorns" && thorns === 0) thorns = 1;
  }
  return thorns;
}

export function createBattleStartState(
  options: CreateBattleStateOptions,
  combatTexts: CombatTextEvent[] = [],
): BattleState {
  const {
    runDeck,
    gold: battleGold = 0,
    totalRooms: battleRooms = 0,
    currentEnemy: battleEnemy,
    talentEffects: battleTalents = createEmptyTalentEffectManifest(),
    discoveredCardIds: battleDiscovered = [],
    trinketIds: battleBoons = [],
    gearEffects: battleGearEffects = createEmptyGearEffectManifest(),
    difficultyModifiers: battleDiffs = [],
    rng: optionsRng,
    contentSystemType: battleContentSystem = "campaign",
    appliesFightPacing: battleAppliesFightPacing = true,
    trackMetrics = false,
  } = options;

  if (!battleEnemy) {
    throw new Error("createBattleState requires currentEnemy; use defaultBattleState for inactive placeholder state.");
  }

  const trinketEffects = computeTrinketManifest(battleBoons);

  if (!optionsRng) {
    throw new Error("createBattleStartState requires rng; pass the battle execution context.");
  }
  const activeRng = optionsRng;
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

  const maxHealth = options.maxHealth ?? MAX_PLAYER_HEALTH;
  const encounterBenefits = battleContentSystem === "labyrinth" ? (options.encounterBenefits ?? []) : [];
  const mana = BASE_PLAYER_MANA + manaBonus + battleTalents.startMana;
  const openingForge = battleTalents.startForge + battleGearEffects.startForge;
  const openingArmor =
    battleTalents.startArmor + battleGearEffects.startArmor + (battleTalents.manaShellActive ? mana : 0);
  const openingBlock =
    battleTalents.startBlock + startBlock + battleGearEffects.startBlock + (battleTalents.manaBulwarkActive ? mana : 0);
  const baseState = defaultBattleState();
  const state: BattleState = {
    ...baseState,
    ...(trackMetrics
      ? { battleMetrics: { enemyAttackActions: 0, enemyAbilityActivations: {}, enemyAbilityUses: {} } }
      : {}),
    deck,
    mana: mana + (encounterBenefits.includes("wellspring") ? LABYRINTH_MODIFIER_CONFIG.manaBonus : 0),
    maxMana: mana,
    encounterBenefits,
    gold: battleGold,
    playerHealth: Math.min(maxHealth, options.playerHealth ?? MAX_PLAYER_HEALTH),
    playerMaxHealth: maxHealth,
    enemyHealth: enemyMaxHealth,
    enemyMaxHealth,
    enemyRegeneration,
    roomScalingMultiplier,
    enemyMitigation: resolveStartingEnemyMitigation(battleEnemy.traits, startingArmor, startingEnemyBlock),
    playerStatuses: {
      ...baseState.playerStatuses,
      phoenixFeather: encounterBenefits.includes("phoenix-nest") ? 1 : 0,
      thorns:
        (encounterBenefits.includes("bramblecoat") ? LABYRINTH_MODIFIER_CONFIG.playerThornsMinimum : 0) +
        battleGearEffects.startThorns +
        battleTalents.startThorns,
    },
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
    difficultyModifiers: battleDiffs,
    rng: activeRng,
    contentSystemType: battleContentSystem,
    appliesFightPacing: battleAppliesFightPacing,
  };
  // Opening grants use the ordinary gain owners, without fight pacing. Forge
  // precedes Block so Tempered Guard sees the Forge already granted.
  let equipped = state;
  const forge = openingForge + (equipped.encounterBenefits.includes("white-heat") ? 2 : 0);
  if (forge > 0) equipped = addForgeToPlayer(equipped, forge, combatTexts);
  if (openingArmor > 0) equipped = applyArmorReward(equipped, openingArmor, combatTexts);
  if (openingBlock > 0) equipped = applyBlockReward(equipped, openingBlock, combatTexts, { skipFightPacing: true });
  const healedState = resolvePendingBattleReactions(
    applyHealingWithCombatText(equipped, battleTalents.startHealth + battleGearEffects.startHeal, combatTexts, {
      skipFightPacing: true,
    }),
    combatTexts,
  );
  const startFreeze = battleGearEffects.startFreeze;
  let started = healedState;
  if (startFreeze > 0 && started.enemyHealth > 0 && started.playerHealth > 0) {
    started = resolvePendingBattleReactions(
      resolveFollowUpHit(
        started,
        { source: "player-follow-up", damageType: "freeze", amount: startFreeze },
        combatTexts,
      ),
      combatTexts,
    );
  }
  if (started.enemyHealth <= 0 || started.playerHealth <= 0 || !battleTalents.drawNatureCardAtCombatStart)
    return started;
  return drawKeywordCard(started, "nature", { combatTexts });
}

export function createBattleState(options: CreateBattleStateOptions): BattleState {
  return drawOpeningHand(createBattleStartState(options));
}
