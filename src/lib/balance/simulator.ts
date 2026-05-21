// Headless balance simulations for battle tuning reports.
// Depends on the pure battle engine and static game data; no React or browser APIs.
import {
  chooseWishCard,
  createBattleState,
  defaultTalentEffects,
  endPlayerTurn,
  getEffectiveCost,
  isPlayerDefeated,
  playBattleCardResolved,
  type BattleState,
  type TalentEffectManifest,
} from "@/lib/battle";
import {
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

export type BalancePlayPolicy = "random-playable" | "greedy-damage" | "defensive-random";
export type BattleSimulationOutcome = "win" | "loss" | "timeout";

// Prebuilt talent progression profiles representing game stages.
export type TalentPreset = "early" | "mid" | "late";

// Builds a manifest for the given preset by taking the first N non-placeholder talents per keyword.
// early = no talents, mid = first 3, late = all.
export function buildPresetManifest(keywords: KeywordId[], preset: TalentPreset): TalentEffectManifest {
  if (preset === "early") return defaultTalentEffects;

  const unlockedTalents: UnlockedTalents = {};
  for (const keywordId of keywords) {
    const keywordTalents = talentPool.filter((t) => t.keywordId === keywordId && (t.effects ?? []).length > 0);
    const count = preset === "mid" ? 3 : keywordTalents.length;
    unlockedTalents[keywordId] = keywordTalents.slice(0, count).map((t) => t.id);
  }
  return computeTalentEffects(unlockedTalents);
}

export type BattleSimulationConfig = {
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
};

export type BattleSimulationResult = {
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
};

export type BalanceBatchConfig = Omit<BattleSimulationConfig, "seed"> & {
  iterations: number;
  seed?: number;
};

export type BalanceBatchResult = {
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
};

const DEFAULT_MAX_TURNS = 30;
const DEFAULT_POLICY: BalancePlayPolicy = "random-playable";
const DEFAULT_SEED = 1;
const RANDOM_UINT_MAX = 0x100000000;

// Provides a tiny deterministic PRNG so balance reports are reproducible across runs.
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / RANDOM_UINT_MAX;
  };
}

// Temporarily routes Math.random through a seeded generator because battle internals currently call Math.random directly.
export function withSeededRandom<T>(seed: number, callback: () => T): T {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

// Finds the configured enemy, throwing early so misspelled report scenarios do not silently test the wrong fight.
function getEnemyById(enemyId: string): BestiaryEntry {
  const enemy = enemyBestiary.find((entry) => entry.id === enemyId);
  if (!enemy) throw new Error(`Unknown enemy id: ${enemyId}`);
  return enemy;
}

// Keeps policy randomness separate from battle randomness while remaining deterministic under the same simulation seed.
function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

// Checks affordability with the same read-only cost prediction used by the UI.
function getPlayableCards(state: BattleState): { card: BattleCard; index: number }[] {
  return state.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => state.mana >= getEffectiveCost(state, card));
}

// Estimates immediate offensive value without trying to become a full game-playing AI.
function getImmediateDamage(card: BattleCard): number {
  return card.effects.reduce((total, effect) => {
    if (effect.kind !== "damage") return total;
    return total + effect.amount;
  }, 0);
}

// Estimates immediate survival value so the defensive policy can react at low Health.
function getImmediateDefense(card: BattleCard): number {
  return card.effects.reduce((total, effect) => {
    if (effect.kind === "heal") return total + effect.amount;
    if (effect.kind === "player-status" && (effect.status === "block" || effect.status === "armor"))
      return total + effect.amount;
    if (effect.kind === "remove-harmful-status") return total + effect.amount * 3;
    return total;
  }, 0);
}

// Picks the next card according to deliberately simple policies that expose broad balance trends.
function chooseCardToPlay(state: BattleState, policy: BalancePlayPolicy): { card: BattleCard; index: number } | null {
  const playable = getPlayableCards(state);
  if (playable.length === 0) return null;

  if (policy === "greedy-damage") {
    return [...playable].sort((a, b) => getImmediateDamage(b.card) - getImmediateDamage(a.card))[0] ?? null;
  }

  if (policy === "defensive-random" && state.playerHealth <= state.playerMaxHealth / 2) {
    const defensive = playable.filter(({ card }) => getImmediateDefense(card) > 0);
    if (defensive.length > 0) return defensive[randomIndex(defensive.length)] ?? null;
  }

  return playable[randomIndex(playable.length)] ?? null;
}

// Resolves Wish prompts deterministically so simulations do not stall on modal-only battle state.
function choosePendingWishCards(state: BattleState): BattleState {
  let nextState = state;
  while (nextState.wishOptions && nextState.wishOptions.length > 0) {
    const choice = nextState.wishOptions[randomIndex(nextState.wishOptions.length)];
    if (!choice) break;
    nextState = chooseWishCard(nextState, choice.id);
  }
  return nextState;
}

// Plays one player turn until the policy has no affordable card left or the enemy dies.
function playAutomatedTurn(
  state: BattleState,
  policy: BalancePlayPolicy,
  cardsPlayed: Record<string, number>,
): BattleState {
  let nextState = choosePendingWishCards(state);

  while (nextState.enemyHealth > 0) {
    const selection = chooseCardToPlay(nextState, policy);
    if (!selection) break;

    const result = playBattleCardResolved(nextState, selection.card.id, selection.index);
    if (result.state === nextState) break;

    cardsPlayed[selection.card.id] = (cardsPlayed[selection.card.id] ?? 0) + 1;
    nextState = choosePendingWishCards(result.state);
  }

  return nextState;
}

// Runs one fully headless battle using real battle state transitions and card effects.
export function simulateBattle(config: BattleSimulationConfig): BattleSimulationResult {
  const seed = config.seed ?? DEFAULT_SEED;
  return withSeededRandom(seed, () => {
    const enemy = getEnemyById(config.enemyId);
    const trinketIds = config.trinketIds ?? [];
    const policy = config.policy ?? DEFAULT_POLICY;
    const playerMaxHealth = config.playerMaxHealth ?? 30;
    const playerDeck = config.deck ?? getStartingDeck(config.characterId);
    const talentEffects =
      config.talentEffects ??
      (config.talentPreset
        ? buildPresetManifest(characters[config.characterId].keywords, config.talentPreset)
        : defaultTalentEffects);
    let state = createBattleState(
      playerDeck,
      config.gold ?? 0,
      config.depth ?? 0,
      enemy,
      config.playerHealth ?? playerMaxHealth,
      talentEffects,
      [],
      playerMaxHealth,
      trinketIds,
      config.difficultyModifiers ?? [],
    );

    const cardsPlayed: Record<string, number> = {};
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;

    while (state.enemyHealth > 0 && !isPlayerDefeated(state) && state.turn <= maxTurns) {
      state = playAutomatedTurn(state, policy, cardsPlayed);
      if (state.enemyHealth <= 0 || isPlayerDefeated(state)) break;
      state = choosePendingWishCards(endPlayerTurn(state).state);
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
      playerMaxHealth: state.playerMaxHealth,
      enemyHealth: state.enemyHealth,
      enemyMaxHealth: state.enemyMaxHealth,
      cardsPlayed,
      totalCardsPlayed: Object.values(cardsPlayed).reduce((total, count) => total + count, 0),
      trinketIds,
      policy,
      seed,
    };
  });
}

// Aggregates many seeded battles into stable enough metrics for rough balance comparisons.
export function simulateBatch(config: BalanceBatchConfig): BalanceBatchResult {
  const baseSeed = config.seed ?? DEFAULT_SEED;
  const results = Array.from({ length: config.iterations }, (_, index) =>
    simulateBattle({ ...config, seed: baseSeed + index }),
  );
  const wins = results.filter((result) => result.outcome === "win").length;
  const losses = results.filter((result) => result.outcome === "loss").length;
  const timeouts = results.filter((result) => result.outcome === "timeout").length;
  const cardPlayCounts: Record<string, number> = {};

  for (const result of results) {
    for (const [cardId, count] of Object.entries(result.cardsPlayed)) {
      cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
    }
  }

  return {
    config,
    iterations: config.iterations,
    wins,
    losses,
    timeouts,
    winRate: wins / config.iterations,
    lossRate: losses / config.iterations,
    timeoutRate: timeouts / config.iterations,
    averageTurns: average(results.map((result) => result.turns)),
    averageHealthRemaining: average(results.map((result) => Math.max(0, result.playerHealth))),
    averageCardsPlayed: average(results.map((result) => result.totalCardsPlayed)),
    cardPlayCounts,
    results,
  };
}

// Keeps report math compact and safe for empty arrays used by future custom filters.
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
