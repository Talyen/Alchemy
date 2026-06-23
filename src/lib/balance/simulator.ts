// Headless balance simulations for battle tuning reports.
// Depends on the pure battle engine and static game data; no React or browser APIs.
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
  enemyBestiary,
  getStartingDeck,
  talentPool,
  computeTalentEffects,
  type BattleCard,
  type BestiaryEntry,
  type CharacterId,
  type KeywordId,
  type UnlockedTalents,
} from "@/lib/game-data";
import type { DifficultyModifier } from "@/lib/game-data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { createSeededRng } from "@/lib/utils";
import { MAX_PLAYER_HEALTH } from "../game-constants";
import { createEmptyAnomalies, sampleAnomalies, type BattleAnomalies } from "./anomalies";
import { buildSimCompanionBondLevels } from "./homestead-preset";

export type BalancePlayPolicy = "random-playable" | "greedy-damage" | "defensive-random";
type BattleSimulationOutcome = "win" | "loss" | "timeout";

export type TalentPreset = "early" | "mid" | "late";

const LATE_AFFINITY_TALENT_CAP = 7;

function buildPresetManifest(keywords: KeywordId[], preset: TalentPreset): TalentEffectManifest {
  if (preset === "early") return defaultTalentEffects;

  const allKeywordIds = [...new Set(talentPool.map((t) => t.keywordId))];
  const affinitySet = new Set(keywords);
  const unlockedTalents: UnlockedTalents = {};

  for (const keywordId of allKeywordIds) {
    const keywordTalents = talentPool.filter((t) => t.keywordId === keywordId && (t.effects ?? []).length > 0);
    const isAffinity = affinitySet.has(keywordId);
    const count =
      preset === "mid"
        ? isAffinity
          ? 5
          : 2
        : isAffinity
          ? Math.min(keywordTalents.length, LATE_AFFINITY_TALENT_CAP)
          : 5;
    unlockedTalents[keywordId] = keywordTalents.slice(0, count).map((t) => t.id);
  }

  return computeTalentEffects(unlockedTalents);
}

export interface BattleSimulationConfig {
  characterId: CharacterId;
  enemyId: string;
  deck?: BattleCard[];
  depth?: number;
  trinketIds?: string[];
  talentEffects?: TalentEffectManifest;
  talentPreset?: TalentPreset;
  difficultyModifiers?: DifficultyModifier[];
  seed?: number;
  maxTurns?: number;
  policy?: BalancePlayPolicy;
  playerHealth?: number;
  playerMaxHealth?: number;
  gold?: number;
}

export { ANOMALY_THRESHOLD_BY_PRESET, ANOMALY_METRICS, getAnomalyThreshold } from "./anomalies";

export interface BattleSimulationResult {
  characterId: CharacterId;
  enemyId: string;
  enemyType: BestiaryEntry["enemyType"];
  outcome: BattleSimulationOutcome;
  turns: number;
  playerHealth: number;
  playerMaxHealth: number;
  enemyHealth: number;
  enemyMaxHealth: number;
  cardsPlayed: Record<string, number>;
  totalCardsPlayed: number;
  trinketIds: string[];
  policy: BalancePlayPolicy;
  seed: number;
  anomalies: BattleAnomalies;
}

export type BalanceBatchConfig = Omit<BattleSimulationConfig, "seed"> & {
  iterations: number;
  seed?: number;
};

export interface BalanceBatchResult {
  config: BalanceBatchConfig;
  iterations: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  lossRate: number;
  timeoutRate: number;
  averageTurns: number;
  averageHealthRemaining: number;
  averageCardsPlayed: number;
  cardPlayCounts: Record<string, number>;
  results: BattleSimulationResult[];
}

const DEFAULT_MAX_TURNS = 30;
const DEFAULT_POLICY: BalancePlayPolicy = "random-playable";
const DEFAULT_SEED = 1;

function randomIndex(rng: () => number, length: number): number {
  return Math.floor(rng() * length);
}

function getPlayableCards(state: BattleState): Array<{ card: BattleCard; index: number }> {
  return state.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card, index }) => canPlayCard(state, card, index));
}

function getImmediateDamage(card: BattleCard): number {
  return card.effects.reduce((total, effect) => {
    if (effect.kind !== "damage") return total;
    return total + effect.amount;
  }, 0);
}

function getImmediateDefense(card: BattleCard): number {
  return card.effects.reduce((total, effect) => {
    if (effect.kind === "heal") return total + effect.amount;
    if (effect.kind === "player-status" && (effect.status === "block" || effect.status === "armor"))
      return total + effect.amount;
    if (effect.kind === "remove-harmful-status") return total + effect.amount * 3;
    return total;
  }, 0);
}

function pickGreedyDamage(
  playable: Array<{ card: BattleCard; index: number }>,
): { card: BattleCard; index: number } | null {
  const first = playable[0];
  if (!first) return null;
  let best = first;
  let bestDamage = getImmediateDamage(best.card);
  for (let i = 1; i < playable.length; i += 1) {
    const candidate = playable[i];
    if (!candidate) continue;
    const damage = getImmediateDamage(candidate.card);
    if (damage > bestDamage) {
      best = candidate;
      bestDamage = damage;
    }
  }
  return { card: best.card, index: best.index };
}

function chooseCardToPlay(state: BattleState, policy: BalancePlayPolicy): { card: BattleCard; index: number } | null {
  const playable = getPlayableCards(state);
  if (playable.length === 0) return null;
  if (policy === "greedy-damage") return pickGreedyDamage(playable);
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
    nextState = choosePendingWishCards(result.state);
  }

  return { state: nextState, combatTexts: allCombatTexts };
}

function resolveTalentEffects(config: BattleSimulationConfig, playerDeck: BattleCard[]): TalentEffectManifest {
  if (config.talentEffects) return config.talentEffects;
  if (!config.talentPreset) return defaultTalentEffects;
  const base = buildPresetManifest(characters[config.characterId].keywords, config.talentPreset);
  const homestead = {
    ...defaultHomesteadEffects,
    companionBondLevels: buildSimCompanionBondLevels(playerDeck, config.talentPreset),
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
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;

  const turnResult = playAutomatedTurn(state, policy, cardsPlayed);
  state = turnResult.state;
  turnCombatTexts.push(...turnResult.combatTexts);
  sampleAnomalies(state, turnCombatTexts, anomalies);
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

function buildSimBattleConfig(config: BattleSimulationConfig, rng: () => number, enemy: BestiaryEntry) {
  const playerMaxHealth = orFallback(config.playerMaxHealth, MAX_PLAYER_HEALTH);
  const playerDeck = orFallback(config.deck, getStartingDeck(config.characterId));
  const talentEffects = resolveTalentEffects(config, playerDeck);

  return {
    state: createBattleState({
      runDeck: playerDeck,
      gold: orFallback(config.gold, 0),
      totalRooms: orFallback(config.depth, 0),
      currentEnemy: enemy,
      playerHealth: orFallback(config.playerHealth, playerMaxHealth),
      talentEffects,
      maxHealth: playerMaxHealth,
      trinketIds: orFallback(config.trinketIds, []),
      difficultyModifiers: orFallback(config.difficultyModifiers, []),
      rng,
    }),
    playerDeck,
    playerMaxHealth,
  };
}

export function simulateBattle(config: BattleSimulationConfig): BattleSimulationResult {
  const seed = orFallback(config.seed, DEFAULT_SEED);
  const rng = createSeededRng(seed);
  const enemy = enemyBestiary.find((entry) => entry.id === config.enemyId);
  if (!enemy) throw new Error(`Unknown enemy id: ${config.enemyId}`);

  const { state: initialState, playerMaxHealth } = buildSimBattleConfig(config, rng, enemy);
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
    trinketIds: orFallback(config.trinketIds, []),
    policy: orFallback(config.policy, DEFAULT_POLICY),
    seed,
    anomalies,
  };
}

export function simulateBatch(config: BalanceBatchConfig): BalanceBatchResult {
  const baseSeed = config.seed ?? DEFAULT_SEED;
  const results = Array.from({ length: config.iterations }, (_, index) =>
    simulateBattle({ ...config, seed: baseSeed + index }),
  );

  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let turnTotal = 0;
  let healthTotal = 0;
  let cardsPlayedTotal = 0;
  const cardPlayCounts: Record<string, number> = {};

  for (const result of results) {
    if (result.outcome === "win") wins += 1;
    else if (result.outcome === "loss") losses += 1;
    else timeouts += 1;
    turnTotal += result.turns;
    healthTotal += Math.max(0, result.playerHealth);
    cardsPlayedTotal += result.totalCardsPlayed;
    for (const [cardId, count] of Object.entries(result.cardsPlayed)) {
      cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
    }
  }

  const iterations = config.iterations;
  return {
    config,
    iterations,
    wins,
    losses,
    timeouts,
    winRate: wins / iterations,
    lossRate: losses / iterations,
    timeoutRate: timeouts / iterations,
    averageTurns: turnTotal / iterations,
    averageHealthRemaining: healthTotal / iterations,
    averageCardsPlayed: cardsPlayedTotal / iterations,
    cardPlayCounts,
    results,
  };
}
