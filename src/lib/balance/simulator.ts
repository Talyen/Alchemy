// Headless balance simulations for battle tuning reports. No React or browser APIs.
import {
  canPlayCard,
  chooseWishCard,
  createBattleState,
  defaultTalentEffects,
  endPlayerTurn,
  isPlayerDefeated,
  playBattleCardResolved,
  processCompanionTurnStart,
  type BattleState,
  type CombatTextEvent,
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
import { createRunStreamRng } from "@/lib/run-rng";
import { MAX_PLAYER_HEALTH } from "../game-constants";
import { createEmptyAnomalies, sampleAnomalies, type BattleAnomalies } from "./anomalies";
import { buildSimCompanionBondLevels } from "./homestead-preset";
import { resolveSimLoadout, type BalanceLoadoutMode } from "./loadout-preset";
import { getEffectiveDamageScore, getImmediateDamage, getImmediateDefense, pickHighestScoring } from "./play-policy";
import type {
  BalancePlayPolicy,
  BattleSimulationConfig,
  BattleSimulationOutcome,
  BattleSimulationResult,
} from "./simulator-types";
export type { BalancePlayPolicy, BattleSimulationConfig, BattleSimulationResult } from "./simulator-types";
import { buildPresetManifest } from "./talent-preset";

const DEFAULT_MAX_TURNS = 30;
const DEFAULT_POLICY: BalancePlayPolicy = "random-playable";
const DEFAULT_LOADOUT: BalanceLoadoutMode = "typical";
export const DEFAULT_SEED = 1;

function randomIndex(rng: () => number, length: number): number {
  return Math.floor(rng() * length);
}

function getPlayableCards(state: BattleState): Array<{ card: BattleCard; index: number }> {
  return state.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card, index }) => canPlayCard(state, card, index));
}

function chooseCardToPlay(state: BattleState, policy: BalancePlayPolicy): { card: BattleCard; index: number } | null {
  const playable = getPlayableCards(state);
  if (playable.length === 0) return null;
  if (policy === "greedy-damage") return pickHighestScoring(playable, getImmediateDamage);
  if (policy === "greedy-effective-damage") {
    return pickHighestScoring(playable, (card) => getEffectiveDamageScore(card, state));
  }
  if (policy === "defensive-random" && state.playerHealth <= state.playerMaxHealth / 2) {
    const defensive = playable.filter(({ card }) => getImmediateDefense(card) > 0);
    if (defensive.length > 0) return defensive[randomIndex(state.rng, defensive.length)] ?? null;
  }
  return playable[randomIndex(state.rng, playable.length)] ?? null;
}

function choosePendingWishCards(state: BattleState): BattleState {
  let nextState = state;
  while (nextState.wishOptions && nextState.wishOptions.length > 0) {
    const choice = nextState.wishOptions[randomIndex(nextState.rng, nextState.wishOptions.length)];
    if (!choice) break;
    nextState = chooseWishCard(nextState, choice.id);
  }
  return nextState;
}

function playAutomatedTurn(
  state: BattleState,
  policy: BalancePlayPolicy,
  cardsPlayed: Record<string, number>,
  anomalies: BattleAnomalies,
): { state: BattleState; combatTexts: CombatTextEvent[] } {
  let nextState = choosePendingWishCards(state);
  const allCombatTexts: CombatTextEvent[] = [];

  while (nextState.enemyHealth > 0) {
    const selection = chooseCardToPlay(nextState, policy);
    if (!selection) break;

    const result = playBattleCardResolved(nextState, selection.card.id, selection.index);
    if (result.state === nextState) break;

    allCombatTexts.push(...result.combatTexts);
    cardsPlayed[selection.card.id] = (cardsPlayed[selection.card.id] ?? 0) + 1;
    sampleAnomalies(result.state, result.combatTexts, anomalies, selection.card.id);
    nextState = choosePendingWishCards(result.state);
  }

  return { state: nextState, combatTexts: allCombatTexts };
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
  const homestead = {
    ...defaultHomesteadEffects,
    ...homesteadCombat,
    companionBondLevels: buildSimCompanionBondLevels(playerDeck, preset ?? "early"),
  };
  return mergeIntoManifest(base, homestead);
}

function runSimTurn(
  state: BattleState,
  policy: BalancePlayPolicy,
  cardsPlayed: Record<string, number>,
  anomalies: BattleAnomalies,
): BattleState {
  const turnCombatTexts: CombatTextEvent[] = [];
  state = processCompanionTurnStart(state, turnCombatTexts);
  sampleAnomalies(state, turnCombatTexts, anomalies);
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;

  const turnResult = playAutomatedTurn(state, policy, cardsPlayed, anomalies);
  state = turnResult.state;
  sampleAnomalies(state, [], anomalies);
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;

  const resolution = endPlayerTurn(state);
  if (resolution.afterAttackState) sampleAnomalies(resolution.afterAttackState, [], anomalies);
  state = choosePendingWishCards(resolution.state);
  sampleAnomalies(state, resolution.combatTexts, anomalies);
  return state;
}

function orFallback<T>(val: T | null | undefined, fallback: T): T {
  return val ?? fallback;
}

function buildSimBattleConfig(config: BattleSimulationConfig, rng: () => number, enemy: BestiaryEntry, seed: number) {
  const playerDeck = orFallback(config.deck, getStartingDeck(config.characterId));
  const preset = config.talentPreset ?? "early";
  const loadout = resolveSimLoadout({
    preset,
    characterId: config.characterId,
    mode: config.loadoutMode ?? DEFAULT_LOADOUT,
    seed,
  });
  const talentEffects = resolveTalentEffects(config, playerDeck, loadout.homesteadCombat);
  const gold = config.gold ?? loadout.gold + talentEffects.startGold;
  const gearEffects = config.gearEffects ?? loadout.gearEffects;
  const trinketIds = config.trinketIds ?? loadout.coreTrinketIds;
  const baseMaxHealth = orFallback(config.playerMaxHealth, MAX_PLAYER_HEALTH);
  const playerMaxHealth =
    config.playerMaxHealth === undefined
      ? baseMaxHealth +
        loadout.talentPointHealth +
        loadout.vitalityHealth +
        talentEffects.runMaxHealthBonus +
        gearEffects.maxHealth
      : baseMaxHealth;

  return {
    state: createBattleState({
      runDeck: playerDeck,
      gold,
      totalRooms: orFallback(config.depth, 0),
      currentEnemy: enemy,
      playerHealth: orFallback(config.playerHealth, playerMaxHealth),
      talentEffects,
      maxHealth: playerMaxHealth,
      trinketIds,
      gearEffects,
      difficultyModifiers: orFallback(config.difficultyModifiers, []),
      rng,
      ...(config.appliesFightPacing === undefined ? {} : { appliesFightPacing: config.appliesFightPacing }),
    }),
    playerDeck,
    playerMaxHealth,
    trinketIds,
  };
}

export function simulateBattle(config: BattleSimulationConfig): BattleSimulationResult {
  const seed = orFallback(config.seed, DEFAULT_SEED);
  const rng = createRunStreamRng(seed, "world");
  const enemy = isEnemyId(config.enemyId) ? enemyById[config.enemyId] : undefined;
  if (!enemy) throw new Error(`Unknown enemy id: ${config.enemyId}`);

  const { state: initialState, playerMaxHealth, trinketIds } = buildSimBattleConfig(config, rng, enemy, seed);
  const maxTurns = orFallback(config.maxTurns, DEFAULT_MAX_TURNS);
  const cardsPlayed: Record<string, number> = {};
  const anomalies = createEmptyAnomalies();

  let state = initialState;

  while (state.enemyHealth > 0 && !isPlayerDefeated(state) && state.turn <= maxTurns) {
    state = runSimTurn(state, orFallback(config.policy, DEFAULT_POLICY), cardsPlayed, anomalies);
  }

  const outcome: BattleSimulationOutcome =
    state.enemyHealth <= 0 ? "win" : isPlayerDefeated(state) ? "loss" : "timeout";

  return {
    characterId: config.characterId,
    enemyId: enemy.id,
    enemyType: enemy.enemyType,
    outcome,
    turns: state.turn,
    playerHealth: state.playerHealth,
    playerMaxHealth,
    enemyHealth: state.enemyHealth,
    enemyMaxHealth: state.enemyMaxHealth,
    cardsPlayed,
    totalCardsPlayed: Object.values(cardsPlayed).reduce((total, count) => total + count, 0),
    trinketIds,
    policy: orFallback(config.policy, DEFAULT_POLICY),
    seed,
    anomalies,
  };
}
