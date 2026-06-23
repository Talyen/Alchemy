// Destination availability and sampling helpers for run navigation.
// Depends on: route filtering config, run progression constants, and alchemy types.
// Depended on by: useRunNavigation for sampling and getting available destinations.
import {
  DEFAULT_DESTINATION_WEIGHT,
  DESTINATION_CHOICES,
  DESTINATION_PITY_WEIGHT_CAP,
  DESTINATION_PITY_WEIGHT_PER_ROUND,
  DESTINATION_POST_OFFER_DAMPEN,
  DESTINATIONS_PER_ACT,
  LAST_OFFERED_DESTINATION_WEIGHT,
} from "@/lib/game-constants";

import {
  getAvailableDestinations as getFilteredDestinations,
  isCombatDestination,
  isShopDestination,
} from "@/lib/routing";
import { DESTINATIONS, type Destination } from "../../shared/types";
import type { RewardState } from "./reward-flow";

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

export interface DestinationWeightContext {
  lastOfferedDestinations: Destination[];
  roundsSinceOffered: Partial<Record<Destination, number>>;
}

export interface SampleDestinationChoicesResult {
  choices: Destination[];
  offerState: DestinationOfferState;
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

export function computeDestinationWeight(destination: Destination, context: DestinationWeightContext): number {
  const pityRounds = context.roundsSinceOffered[destination] ?? 0;
  const pity = Math.min(pityRounds * DESTINATION_PITY_WEIGHT_PER_ROUND, DESTINATION_PITY_WEIGHT_CAP);
  const wasLastOffered = context.lastOfferedDestinations.includes(destination);
  const repeatMultiplier = wasLastOffered ? LAST_OFFERED_DESTINATION_WEIGHT / DEFAULT_DESTINATION_WEIGHT : 1;
  const dampen = wasLastOffered ? DESTINATION_POST_OFFER_DAMPEN : 0;
  return Math.max(1, (DEFAULT_DESTINATION_WEIGHT + pity) * repeatMultiplier - dampen);
}

function weightedPick(pool: Destination[], context: DestinationWeightContext, rng: () => number): Destination | null {
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
  weightContext: DestinationWeightContext,
  rng: () => number,
): { picked: Destination; remaining: Destination[] } | null {
  const combatPool = remaining.filter(isCombatDestination);
  const picked = weightedPick(combatPool, weightContext, rng);
  if (!picked) return null;
  return { picked, remaining: remaining.filter((d) => d !== picked && !isCombatDestination(d)) };
}

function fillRemainingSlots(
  remaining: Destination[],
  weightContext: DestinationWeightContext,
  rng: () => number,
  capacity: number = DESTINATION_CHOICES,
): Destination[] {
  const choices: Destination[] = [];
  while (choices.length < capacity && remaining.length > 0) {
    const hasShop = choices.some(isShopDestination);
    const pool = hasShop ? remaining.filter((d) => !isShopDestination(d)) : remaining;
    if (pool.length === 0) break;
    const picked = weightedPick(pool, weightContext, rng);
    if (!picked) break;
    choices.push(picked);
    remaining = remaining.filter((d) => d !== picked);
  }
  return choices;
}

export function sampleDestinationChoices(
  destinations: Destination[],
  offerState: DestinationOfferState = createEmptyDestinationOfferState(),
  rng: () => number = Math.random,
): SampleDestinationChoicesResult {
  if (destinations.length === 1 && destinations[0] === DESTINATIONS.BOSS_COMBAT) {
    return {
      choices: [DESTINATIONS.BOSS_COMBAT],
      offerState: advanceDestinationOfferState(offerState, destinations, [DESTINATIONS.BOSS_COMBAT]),
    };
  }

  const weightContext = {
    lastOfferedDestinations: offerState.lastOfferedDestinations,
    roundsSinceOffered: offerState.roundsSinceOffered,
  };
  let remaining = [...destinations];
  const choices: Destination[] = [];

  if (!lastOfferedIncludesCombat(offerState.lastOfferedDestinations)) {
    const pity = pickCombatPity(remaining, weightContext, rng);
    if (pity) {
      choices.push(pity.picked);
      remaining = pity.remaining;
    }
  }

  choices.push(...fillRemainingSlots(remaining, weightContext, rng, DESTINATION_CHOICES - choices.length));

  // Top up to DESTINATION_CHOICES if weighted picking under-filled. Boss-only pools
  // already short-circuit at the top of this function, so this only runs for normal acts.
  if (choices.length < DESTINATION_CHOICES) {
    const used = new Set(choices);
    const fillers = destinations.filter((d) => !used.has(d));
    while (choices.length < DESTINATION_CHOICES && fillers.length > 0) {
      const idx = Math.floor(rng() * fillers.length);
      const [picked] = fillers.splice(idx, 1);
      if (picked) choices.push(picked);
    }
  }

  return { choices, offerState: advanceDestinationOfferState(offerState, destinations, choices) };
}

/** Campaign resume keeps prior choices; advancing samples fresh destinations for the next room. */
export function restoreOrCreateDestinationRewardState(
  prev: RewardState,
  options: {
    availableDestinations: Destination[];
    offerState: DestinationOfferState;
    bossEnemyId: string;
    onSampled?: (result: SampleDestinationChoicesResult) => void;
  },
): RewardState {
  if (prev.destinations.length > 0) {
    return withSelectedBossForDestinations(
      prev.destinations,
      { ...prev, destinations: prev.destinations },
      options.bossEnemyId,
    );
  }

  const sampled = sampleDestinationChoices(options.availableDestinations, options.offerState);
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
