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
import { createRunStreamRng, getBattleRng, rngInt } from "@/lib/rng";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
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
import { buildPresetManifest } from "./talent-preset";

export const DEFAULT_MAX_TURNS = 30;
const DEFAULT_POLICY: BalancePlayPolicy = "random-playable";
const DEFAULT_LOADOUT: BalanceLoadoutMode = "typical";
export const DEFAULT_SEED = 1;

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
    if (defensive.length > 0) return defensive[rngInt(getBattleRng(state), defensive.length)] ?? null;
  }
  return playable[rngInt(getBattleRng(state), playable.length)] ?? null;
}

function choosePendingWishCards(state: BattleState): BattleState {
  let nextState = state;
  while (nextState.wishOptions && nextState.wishOptions.length > 0) {
    const choice = nextState.wishOptions[rngInt(getBattleRng(nextState), nextState.wishOptions.length)];
    if (!choice) break;
    nextState = chooseWishCard(nextState, choice.id);
  }
  return nextState;
}

const SCRATCH_COMBAT_TEXTS: CombatTextEvent[] = [];
// Reused across non-tracking turns only: never retained by handlers and sims
// run synchronously, so clearing + reusing is safe. Do not retain or re-enter.

function playAutomatedTurn(
  state: BattleState,
  policy: BalancePlayPolicy,
  cardsPlayed: Record<string, number> | null,
  anomalies: BattleAnomalies | null,
): BattleState {
  let nextState = choosePendingWishCards(state);

  while (nextState.enemyHealth > 0 && !isPlayerDefeated(nextState)) {
    const selection = chooseCardToPlay(nextState, policy);
    if (!selection) break;

    const result = playBattleCardResolved(nextState, selection.card.id, selection.index);
    if (result.state === nextState) break;

    if (cardsPlayed) {
      cardsPlayed[selection.card.id] = (cardsPlayed[selection.card.id] ?? 0) + 1;
    }
    if (anomalies) sampleAnomalies(result.state, result.combatTexts, anomalies, selection.card.id);
    nextState = choosePendingWishCards(result.state);
  }

  return nextState;
}

function deckHasCompanions(deck: readonly BattleCard[]): boolean {
  return deck.some((card) => card.effects.some((effect) => effect.kind === "summon-companion"));
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
  const hasCompanions = deckHasCompanions(playerDeck);
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
  state: BattleState,
  policy: BalancePlayPolicy,
  cardsPlayed: Record<string, number> | null,
  anomalies: BattleAnomalies | null,
): BattleState {
  let turnCombatTexts: CombatTextEvent[];
  if (anomalies) {
    turnCombatTexts = [];
  } else {
    SCRATCH_COMBAT_TEXTS.length = 0;
    turnCombatTexts = SCRATCH_COMBAT_TEXTS;
  }
  state = processCompanionTurnStart(state, turnCombatTexts);
  if (anomalies) sampleAnomalies(state, turnCombatTexts, anomalies);
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;

  state = playAutomatedTurn(state, policy, cardsPlayed, anomalies);
  if (anomalies) sampleAnomalies(state, [], anomalies);
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;

  const resolution = endPlayerTurn(state);
  if (anomalies && resolution.afterAbilityState) {
    sampleAnomalies(resolution.afterAbilityState, [], anomalies);
  }
  state = choosePendingWishCards(resolution.state);
  if (anomalies) sampleAnomalies(state, resolution.combatTexts, anomalies);
  return state;
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
    state: createBattleState({
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
      rng,
      ...(config.appliesFightPacing === undefined ? {} : { appliesFightPacing: config.appliesFightPacing }),
    }),
    playerDeck,
    playerMaxHealth,
    trinketIds,
  };
}

const EMPTY_ANOMALIES_SENTINEL: BattleAnomalies = Object.freeze(createEmptyAnomalies());
// Shared frozen fallbacks for trackMetrics/trackAnomalies:false — read-only,
// do not mutate. Callers needing a mutable map must copy first.
const EMPTY_CARDS_RECORD: Readonly<Record<string, number>> = Object.freeze({});

export function simulateBattle(config: BattleSimulationConfig): BattleSimulationResult {
  const seed = config.seed ?? DEFAULT_SEED;
  const policy = config.policy ?? DEFAULT_POLICY;
  const rng = createRunStreamRng(seed, "world");
  const enemy = isEnemyId(config.enemyId) ? enemyById[config.enemyId] : undefined;
  if (!enemy) throw new Error(`Unknown enemy id: ${config.enemyId}`);

  const { state: initialState, playerMaxHealth, trinketIds } = buildSimBattleConfig(config, rng, enemy, seed);
  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
  const trackMetrics = config.trackMetrics !== false;
  const cardsPlayed: Record<string, number> | null = trackMetrics ? {} : null;
  const trackAnomalies = config.trackAnomalies !== false;
  const anomalies = trackAnomalies ? createEmptyAnomalies() : null;

  let state: BattleState = { ...initialState, battleMetrics: { enemyAttackActions: 0, enemyAbilityActivations: {} } };
  let turns = 0;

  while (state.enemyHealth > 0 && !isPlayerDefeated(state) && turns < maxTurns) {
    turns += 1;
    state = runSimTurn(state, policy, cardsPlayed, anomalies);
  }

  const outcome: BattleSimulationOutcome =
    state.enemyHealth <= 0 ? "win" : isPlayerDefeated(state) ? "loss" : "timeout";

  const battleMetrics = state.battleMetrics ?? { enemyAttackActions: 0, enemyAbilityActivations: {} };
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
    combatGoldEarned: trackMetrics ? state.gold - initialState.gold : 0,
    trinketIds,
    policy,
    seed,
    anomalies: anomalies ?? EMPTY_ANOMALIES_SENTINEL,
  };
}
