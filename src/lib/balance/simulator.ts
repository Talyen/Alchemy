import {
  battleSnapshot,
  canPlayCard,
  chooseWishCard,
  resolveBattleStart,
  defaultTalentEffects,
  resolveBattleTurn,
  isPlayerDefeated,
  playBattleCardResolved,
  type BattleSnapshot,
} from "@/lib/battle";
import {
  type TalentEffectManifest,
  characters,
  enemyById,
  getStartingDeck,
  isEnemyId,
  type BattleCard,
  type BestiaryEntry,
} from "@/lib/game-data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { createRunRngState, createRunStateRng, createSeededRng, hashStringToUint32, rngInt, type Rng } from "@/lib/rng";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { createEmptyAnomalies, sampleAnomalies, type BattleAnomalies } from "./anomalies";
import { companionIdsFromDeck } from "./companion-deck";
import { buildSimCompanionBondLevels } from "./homestead-preset";
import { resolveSimLoadout, type BalanceLoadoutMode } from "./loadout-preset";
import { getEffectiveDamageScore, getImmediateDamage, getImmediateDefense, pickHighestScoring } from "./play-policy";
import type {
  BalancePlayPolicy,
  BattleSimulationConfig,
  BattleSimulationOutcome,
  BattleSimulationResult,
} from "./simulator-types";
import { buildPresetManifest } from "./talent-preset";

export const DEFAULT_MAX_TURNS = 30;
const DEFAULT_POLICY: BalancePlayPolicy = "random-playable";
const DEFAULT_LOADOUT: BalanceLoadoutMode = "typical";
export const DEFAULT_SEED = 1;

function getPlayableCards(state: BattleSnapshot): Array<{ card: BattleCard; index: number }> {
  const hand = state.hand;
  const playable: Array<{ card: BattleCard; index: number }> = [];
  for (let index = 0; index < hand.length; index += 1) {
    const card = hand[index];
    if (card && canPlayCard(state, card, index)) {
      playable.push({ card, index });
    }
  }
  return playable;
}

function chooseCardToPlay(
  state: BattleSnapshot,
  policy: BalancePlayPolicy,
  policyRng: Rng,
): { card: BattleCard; index: number } | null {
  const playable = getPlayableCards(state);
  if (playable.length === 0) return null;
  if (policy === "greedy-damage") return pickHighestScoring(playable, getImmediateDamage);
  if (policy === "greedy-effective-damage") {
    return pickHighestScoring(playable, (card) => getEffectiveDamageScore(card, state));
  }
  if (policy === "defensive-random" && state.playerHealth <= state.playerMaxHealth / 2) {
    const defensive = playable.filter(({ card }) => getImmediateDefense(card) > 0);
    if (defensive.length > 0) return defensive[rngInt(policyRng, defensive.length)] ?? null;
  }
  return playable[rngInt(policyRng, playable.length)] ?? null;
}

function choosePendingWishCards(state: BattleSnapshot, combatRng: Rng, policyRng: Rng): BattleSnapshot {
  let nextState = state;
  while (nextState.wishOptions && nextState.wishOptions.length > 0) {
    const choice = nextState.wishOptions[rngInt(policyRng, nextState.wishOptions.length)];
    if (!choice) break;
    nextState = battleSnapshot(chooseWishCard({ ...nextState, rng: combatRng }, choice.id));
  }
  return nextState;
}

interface SimulationTracking {
  cardsPlayed: Record<string, number> | null;
  anomalies: BattleAnomalies | null;
}

function playAutomatedTurn(
  state: BattleSnapshot,
  policy: BalancePlayPolicy,
  { cardsPlayed, anomalies }: SimulationTracking,
  combatRng: Rng,
  policyRng: Rng,
): BattleSnapshot {
  let nextState = choosePendingWishCards(state, combatRng, policyRng);

  while (nextState.enemyHealth > 0 && !isPlayerDefeated(nextState)) {
    const selection = chooseCardToPlay(nextState, policy, policyRng);
    if (!selection) break;

    const bound = { ...nextState, rng: combatRng };
    const result = playBattleCardResolved(bound, selection.card.id, selection.index);
    if (result.state === bound) break;

    if (cardsPlayed) {
      cardsPlayed[selection.card.id] = (cardsPlayed[selection.card.id] ?? 0) + 1;
    }
    if (anomalies) sampleAnomalies(result.state, result.combatTexts, anomalies, selection.card.id);
    nextState = choosePendingWishCards(battleSnapshot(result.state), combatRng, policyRng);
  }

  return nextState;
}

function resolveTalentEffects(
  config: BattleSimulationConfig,
  playerDeck: BattleCard[],
  homesteadCombat: ReturnType<typeof resolveSimLoadout>["homesteadCombat"],
): TalentEffectManifest {
  const preset = config.talentPreset;
  const base =
    config.talentEffects ??
    (preset ? buildPresetManifest(characters[config.characterId].keywords, preset) : defaultTalentEffects);
  const isBare = config.loadoutMode === "bare";
  const hasCompanions = companionIdsFromDeck(playerDeck).length > 0;
  if (isBare && !hasCompanions) {
    return base;
  }
  const homestead = {
    ...defaultHomesteadEffects,
    ...homesteadCombat,
    companionBondLevels: hasCompanions
      ? buildSimCompanionBondLevels(playerDeck, preset ?? "early")
      : defaultHomesteadEffects.companionBondLevels,
  };
  return mergeIntoManifest(base, homestead);
}

function runSimTurn(
  state: BattleSnapshot,
  policy: BalancePlayPolicy,
  tracking: SimulationTracking,
  combatRng: Rng,
  policyRng: Rng,
  remainingTurns: number,
): { state: BattleSnapshot; turns: number } {
  state = playAutomatedTurn(state, policy, tracking, combatRng, policyRng);
  if (tracking.anomalies) sampleAnomalies(state, [], tracking.anomalies);
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return { state, turns: 1 };

  const resolution = resolveBattleTurn(state, { rng: combatRng }, { maxTurns: remainingTurns });
  if (tracking.anomalies) {
    for (const frame of resolution.frames) {
      if (frame.turn.kind !== "haste") sampleAnomalies(frame.turn.enemyTurnStartState, [], tracking.anomalies);
      if (frame.turn.afterAbilityState) sampleAnomalies(frame.turn.afterAbilityState, [], tracking.anomalies);
      sampleAnomalies(frame.turn.state, frame.turn.combatTexts, tracking.anomalies);
      if (frame.companion) sampleAnomalies(frame.companion.state, frame.companion.texts, tracking.anomalies);
    }
  }
  return { state: resolution.state, turns: resolution.frames.length };
}

function buildSimBattleConfig(config: BattleSimulationConfig, rng: () => number, enemy: BestiaryEntry, seed: number) {
  const playerDeck = config.deck ?? getStartingDeck(config.characterId);
  const preset = config.talentPreset ?? "early";
  const loadout = resolveSimLoadout({
    preset,
    characterId: config.characterId,
    mode: config.loadoutMode ?? DEFAULT_LOADOUT,
    seed,
    skipGear: Boolean(config.gearEffects),
  });
  const talentEffects = resolveTalentEffects(config, playerDeck, loadout.homesteadCombat);
  const gold = config.gold ?? loadout.gold + talentEffects.startGold;
  const gearEffects = config.gearEffects ?? loadout.gearEffects;
  const trinketIds = config.trinketIds ?? loadout.coreTrinketIds;
  const baseMaxHealth = config.playerMaxHealth ?? MAX_PLAYER_HEALTH;
  const playerMaxHealth =
    baseMaxHealth + loadout.talentPointHealth + talentEffects.runMaxHealthBonus + gearEffects.maxHealth;

  return {
    opening: resolveBattleStart(
      {
        trackMetrics: true,
        runDeck: playerDeck,
        gold,
        totalRooms: config.depth ?? 0,
        currentEnemy: enemy,
        playerHealth: config.playerHealth ?? playerMaxHealth,
        talentEffects,
        maxHealth: playerMaxHealth,
        trinketIds,
        gearEffects,
        difficultyModifiers: config.difficultyModifiers ?? [],
        ...(config.appliesFightPacing === undefined ? {} : { appliesFightPacing: config.appliesFightPacing }),
      },
      { rng },
    ),
    playerMaxHealth,
    trinketIds,
    startingGold: gold,
  };
}

const EMPTY_ANOMALIES_SENTINEL: BattleAnomalies = Object.freeze(createEmptyAnomalies());
// Shared frozen fallbacks for trackMetrics/trackAnomalies:false — read-only,
// do not mutate. Callers needing a mutable map must copy first.
const EMPTY_CARDS_RECORD: Readonly<Record<string, number>> = Object.freeze({});

export function simulateBattle(config: BattleSimulationConfig): BattleSimulationResult {
  const seed = config.seed ?? DEFAULT_SEED;
  const policy = config.policy ?? DEFAULT_POLICY;
  const rng = createRunStateRng(createRunRngState(seed), "world");
  // Decisions belong to the simulated player, not the persisted combat stream.
  const policyRng = createSeededRng(hashStringToUint32(`balance-policy:${seed}`));
  const enemy = isEnemyId(config.enemyId) ? enemyById[config.enemyId] : undefined;
  if (!enemy) throw new Error(`Unknown enemy id: ${config.enemyId}`);

  const { opening, playerMaxHealth, trinketIds, startingGold } = buildSimBattleConfig(config, rng, enemy, seed);
  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
  const trackMetrics = config.trackMetrics !== false;
  const cardsPlayed: Record<string, number> | null = trackMetrics ? {} : null;
  const anomalies = config.trackAnomalies !== false ? createEmptyAnomalies() : null;
  const tracking: SimulationTracking = { cardsPlayed, anomalies };
  const initialState = opening.state;
  if (anomalies) {
    if (opening.companion) sampleAnomalies(opening.companion.state, opening.companion.texts, anomalies);
    sampleAnomalies(initialState, [], anomalies);
  }

  let state = initialState;
  let turns = 0;

  while (state.enemyHealth > 0 && !isPlayerDefeated(state) && turns < maxTurns) {
    const result = runSimTurn(state, policy, tracking, rng, policyRng, maxTurns - turns);
    state = result.state;
    turns += result.turns;
  }

  const outcome: BattleSimulationOutcome =
    state.enemyHealth <= 0 ? "win" : isPlayerDefeated(state) ? "loss" : "timeout";

  const battleMetrics = state.battleMetrics ?? {
    enemyAttackActions: 0,
    enemyAbilityActivations: {},
    enemyAbilityUses: {},
  };
  return {
    characterId: config.characterId,
    enemyId: enemy.id,
    enemyType: enemy.enemyType,
    outcome,
    turns,
    playerHealth: state.playerHealth,
    playerMaxHealth,
    enemyHealth: state.enemyHealth,
    enemyMaxHealth: state.enemyMaxHealth,
    enemyAttackActions: battleMetrics.enemyAttackActions,
    enemyAbilityActivations: battleMetrics.enemyAbilityActivations,
    enemyAbilityUses: battleMetrics.enemyAbilityUses ?? {},
    wonBeforeEnemyAttack: outcome === "win" && battleMetrics.enemyAttackActions === 0,
    cardsPlayed: cardsPlayed ?? EMPTY_CARDS_RECORD,
    totalCardsPlayed: cardsPlayed ? Object.values(cardsPlayed).reduce((total, count) => total + count, 0) : 0,
    combatGoldEarned: trackMetrics ? state.gold - startingGold : 0,
    trinketIds,
    policy,
    seed,
    anomalies: anomalies ?? EMPTY_ANOMALIES_SENTINEL,
  };
}
