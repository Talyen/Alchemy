// Destination availability and sampling helpers for run navigation.
// Depends on: route filtering config, run progression constants, and alchemy types.
// Depended on by: useRunFlowEngine for sampling and getting available destinations.
import {
  DEFAULT_DESTINATION_WEIGHT,
  CORRUPTION_DESTINATION_WEIGHT,
  DESTINATION_CHOICES,
  DESTINATION_PITY_WEIGHT_CAP,
  DESTINATION_PITY_WEIGHT_PER_ROUND,
  DESTINATION_POST_OFFER_DAMPEN,
  DESTINATIONS_PER_ACT,
  LAST_OFFERED_DESTINATION_WEIGHT,
} from "@/lib/game-constants";

import {
  DESTINATIONS,
  getAvailableDestinations as getFilteredDestinations,
  isCombatDestination,
  isShopDestination,
  type Destination,
} from "@/lib/routing";
import { createEmptyRewardState, type RewardState } from "@/lib/active-run-session";

export interface DestinationOptionsInput {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
  hasAnyOwnedGear?: boolean;
}

export interface DestinationOfferState {
  lastOfferedDestinations: Destination[];
  roundsSinceOffered: Partial<Record<Destination, number>>;
}

export interface SampleDestinationChoicesResult {
  choices: Destination[];
  offerState: DestinationOfferState;
}

export interface InitialDestinationResult {
  rewardState: RewardState;
  offerState: DestinationOfferState;
}

interface CreateInitialDestinationResultInput {
  availableDestinations: Destination[];
  offerState: DestinationOfferState;
  bossEnemyId: string;
  rng: () => number;
}

interface DestinationAvailabilityInput {
  destinationIndexInAct: number;
  currentHealth: number;
  currentGold: number;
  maxHealth: number;
  previousDestination?: Destination | undefined;
  hasAnyOwnedGear?: boolean;
}

export function createEmptyDestinationOfferState(): DestinationOfferState {
  return { lastOfferedDestinations: [], roundsSinceOffered: {} };
}

// Boss routing is injected by act progress; normal filtering stays in config so Health/gold
// gates can be reused without knowing run progression.
export function getRunAvailableDestinations({
  destinationIndexInAct,
  currentHealth,
  currentGold,
  maxHealth,
  previousDestination,
  hasAnyOwnedGear = true,
}: DestinationAvailabilityInput): Destination[] {
  if (destinationIndexInAct >= DESTINATIONS_PER_ACT - 1) {
    return [DESTINATIONS.BOSS_COMBAT];
  }
  const destinations = getFilteredDestinations(currentHealth, currentGold, maxHealth, hasAnyOwnedGear);
  return previousDestination === DESTINATIONS.CORRUPTION
    ? destinations.filter((destination) => destination !== DESTINATIONS.CORRUPTION)
    : destinations;
}

export function lastOfferedIncludesCombat(lastOfferedDestinations: Destination[]): boolean {
  return lastOfferedDestinations.some(isCombatDestination);
}

export function computeDestinationWeight(destination: Destination, context: DestinationOfferState): number {
  const baseWeight =
    destination === DESTINATIONS.CORRUPTION ? CORRUPTION_DESTINATION_WEIGHT : DEFAULT_DESTINATION_WEIGHT;
  const pityRounds = context.roundsSinceOffered[destination] ?? 0;
  const pity = Math.min(pityRounds * DESTINATION_PITY_WEIGHT_PER_ROUND, DESTINATION_PITY_WEIGHT_CAP);
  const wasLastOffered = context.lastOfferedDestinations.includes(destination);
  const repeatMultiplier = wasLastOffered ? LAST_OFFERED_DESTINATION_WEIGHT / baseWeight : 1;
  const dampen = wasLastOffered ? DESTINATION_POST_OFFER_DAMPEN : 0;
  return Math.max(1, (baseWeight + pity) * repeatMultiplier - dampen);
}

function weightedPick(pool: Destination[], context: DestinationOfferState, rng: () => number): Destination | null {
  if (pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, destination) => sum + computeDestinationWeight(destination, context), 0);
  if (totalWeight <= 0) return pool[0] ?? null;
  let roll = rng() * totalWeight;
  const selectedIndex = pool.findIndex((destination) => {
    roll -= computeDestinationWeight(destination, context);
    return roll < 0;
  });
  return pool[selectedIndex >= 0 ? selectedIndex : pool.length - 1] ?? null;
}

export function advanceDestinationOfferState(
  offerState: DestinationOfferState,
  eligibleDestinations: Destination[],
  choices: Destination[],
): DestinationOfferState {
  const roundsSinceOffered = { ...offerState.roundsSinceOffered };
  for (const destination of eligibleDestinations) {
    if (choices.includes(destination)) {
      roundsSinceOffered[destination] = 0;
    } else {
      roundsSinceOffered[destination] = (roundsSinceOffered[destination] ?? 0) + 1;
    }
  }
  return {
    lastOfferedDestinations: [...choices],
    roundsSinceOffered,
  };
}

function pickCombatPity(
  remaining: Destination[],
  weightContext: DestinationOfferState,
  rng: () => number,
): { picked: Destination; remaining: Destination[] } | null {
  const combatPool = remaining.filter(isCombatDestination);
  const picked = weightedPick(combatPool, weightContext, rng);
  if (!picked) return null;
  return { picked, remaining: remaining.filter((d) => d !== picked && !isCombatDestination(d)) };
}

export function sampleDestinationChoices(
  destinations: Destination[],
  offerState: DestinationOfferState = createEmptyDestinationOfferState(),
  rng: () => number,
): SampleDestinationChoicesResult {
  const eligibleDestinations = [...new Set(destinations)];
  if (eligibleDestinations.length === 1 && eligibleDestinations[0] === DESTINATIONS.BOSS_COMBAT) {
    return {
      choices: [DESTINATIONS.BOSS_COMBAT],
      offerState: advanceDestinationOfferState(offerState, eligibleDestinations, [DESTINATIONS.BOSS_COMBAT]),
    };
  }

  let remaining = [...eligibleDestinations];
  const choices: Destination[] = [];

  if (!lastOfferedIncludesCombat(offerState.lastOfferedDestinations)) {
    const pity = pickCombatPity(remaining, offerState, rng);
    if (pity) {
      choices.push(pity.picked);
      remaining = pity.remaining;
    }
  }

  while (choices.length < DESTINATION_CHOICES && remaining.length > 0) {
    const pool = choices.some(isShopDestination) ? remaining.filter((d) => !isShopDestination(d)) : remaining;
    const picked = weightedPick(pool, offerState, rng);
    if (!picked) break;
    choices.push(picked);
    remaining = remaining.filter((destination) => destination !== picked);
  }

  return { choices, offerState: advanceDestinationOfferState(offerState, eligibleDestinations, choices) };
}

/** Create the initial destination picker state from explicit, command-owned inputs. */
export function createInitialDestinationResult({
  availableDestinations,
  offerState,
  bossEnemyId,
  rng,
}: CreateInitialDestinationResultInput): InitialDestinationResult {
  const sampled = sampleDestinationChoices(availableDestinations, offerState, rng);
  return {
    offerState: sampled.offerState,
    rewardState: createDestinationRewardState(sampled.choices, bossEnemyId),
  };
}

/** Campaign resume keeps prior choices; advancing samples fresh destinations for the next room. */
export function restoreOrCreateDestinationRewardState(
  prev: RewardState,
  options: {
    availableDestinations: Destination[];
    offerState: DestinationOfferState;
    bossEnemyId: string;
    rng: () => number;
    onSampled?: (result: SampleDestinationChoicesResult) => void;
  },
): RewardState {
  if (prev.destinations.length > 0) {
    return withSelectedBossForDestinations(prev.destinations, { ...prev }, options.bossEnemyId);
  }

  const sampled = sampleDestinationChoices(options.availableDestinations, options.offerState, options.rng);
  options.onSampled?.(sampled);
  return withSelectedBossForDestinations(
    sampled.choices,
    { ...prev, destinations: sampled.choices },
    options.bossEnemyId,
  );
}

export function withSelectedBossForDestinations(
  destinations: Destination[],
  rewardState: RewardState,
  bossEnemyId?: string | null,
): RewardState {
  if (destinations.length === 1 && destinations[0] === DESTINATIONS.BOSS_COMBAT) {
    return { ...rewardState, selectedBossId: rewardState.selectedBossId ?? bossEnemyId ?? null };
  }
  return { ...rewardState, selectedBossId: null };
}

/** Build a destination-picker reward state, selecting boss id when the only choice is boss combat. */
export function createDestinationRewardState(destinations: Destination[], bossEnemyId?: string | null): RewardState {
  return withSelectedBossForDestinations(destinations, createEmptyRewardState(destinations), bossEnemyId);
}
